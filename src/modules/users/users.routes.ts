import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createSuccessResponse } from "../../shared/response";
import { validateJsonBody } from "../../shared/http/validation";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { authGuard, type AuthVariables } from "../auth/auth.middleware";
import type { AuthService } from "../auth/auth.service";
import { createAuthRepository, type AuthRepository } from "../auth/auth.repository";
import { createAuthService } from "../auth/auth.service";
import { createUsersRepository, type UsersRepository } from "./users.repository";
import { createUsersService, type UsersService } from "./users.service";
import { onboardingSchema, userSettingsSchema } from "./users.schema";

export type UsersRoutesOptions = {
  config: AppConfig;
  databaseSource?: DatabaseSource;
  authRepository?: AuthRepository;
  usersRepository?: UsersRepository;
  authService?: AuthService;
};

async function withUsersService<T>(options: UsersRoutesOptions, action: (service: UsersService, authService: AuthService) => Promise<T>) {
  if (options.usersRepository && (options.authService || options.authRepository)) {
    const authService = options.authService ?? createAuthService(options.authRepository!, options.config);
    return action(createUsersService(options.usersRepository), authService);
  }

  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    const authService = createAuthService(createAuthRepository(handle.db), options.config);
    return await action(createUsersService(createUsersRepository(handle.db)), authService);
  } finally {
    await handle.close();
  }
}

export function createUsersRoutes(options: UsersRoutesOptions) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.get("/users/me", async (context) => {
    return withUsersService(options, async (service, authService) => {
      const middleware = authGuard({ service: authService, config: options.config });
      await middleware(context, async () => undefined);
      const user = context.get("auth").user;
      const profile = await service.getCurrentProfile(user.id);
      return context.json(createSuccessResponse({ data: profile }));
    });
  });

  routes.put("/users/settings", async (context) => {
    return withUsersService(options, async (service, authService) => {
      const middleware = authGuard({ service: authService, config: options.config });
      await middleware(context, async () => undefined);
      const payload = await validateJsonBody(context, userSettingsSchema);
      const profile = await service.updateSettings(context.get("auth").user.id, payload);
      return context.json(createSuccessResponse({ message: "Settings updated successfully", data: profile }));
    });
  });

  routes.post("/auth/onboarding", async (context) => {
    return withUsersService(options, async (service, authService) => {
      const middleware = authGuard({ service: authService, config: options.config });
      await middleware(context, async () => undefined);
      const payload = await validateJsonBody(context, onboardingSchema);
      const profile = await service.completeOnboarding(context.get("auth").user.id, payload);
      return context.json(createSuccessResponse({ message: "Onboarding completed successfully", data: profile }));
    });
  });

  return routes;
}
