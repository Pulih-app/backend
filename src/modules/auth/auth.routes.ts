import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createSuccessResponse } from "../../shared/response";
import { validateJsonBody } from "../../shared/http/validation";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { createAuthRepository, type AuthRepository } from "./auth.repository";
import { createAuthService, type AuthService } from "./auth.service";
import { loginSchema, registerSchema } from "./auth.schema";
import { authGuard, type AuthVariables } from "./auth.middleware";

export type AuthRoutesOptions = {
  config: AppConfig;
  databaseSource?: DatabaseSource;
  repository?: AuthRepository;
};

async function withAuthService<T>(options: AuthRoutesOptions, action: (service: AuthService) => Promise<T>) {
  if (options.repository) {
    return action(createAuthService(options.repository, options.config));
  }

  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    return await action(createAuthService(createAuthRepository(handle.db), options.config));
  } finally {
    await handle.close();
  }
}

export function createAuthRoutes(options: AuthRoutesOptions) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/auth/register", async (context) => {
    const payload = await validateJsonBody(context, registerSchema);
    const result = await withAuthService(options, (service) => service.register(payload));

    return context.json(createSuccessResponse({ message: "Registration successful", data: result }), 201);
  });

  routes.post("/auth/login", async (context) => {
    const payload = await validateJsonBody(context, loginSchema);
    const result = await withAuthService(options, (service) => service.login(payload));

    return context.json(createSuccessResponse({ message: "Login successful", data: result }));
  });

  routes.post("/auth/logout", (context) => {
    return context.json(createSuccessResponse({ message: "Logout successful", data: null }));
  });

  routes.get("/auth/me", async (context) => {
    return withAuthService(options, async (service) => {
      const middleware = authGuard({ service, config: options.config });
      await middleware(context, async () => undefined);
      return context.json(createSuccessResponse({ data: context.get("auth").user }));
    });
  });

  return routes;
}
