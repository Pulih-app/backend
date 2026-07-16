import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createSuccessResponse } from "../../shared/response";
import { validateJsonBody } from "../../shared/http/validation";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { authGuard, type AuthVariables } from "../auth/auth.middleware";
import { createAuthRepository, type AuthRepository } from "../auth/auth.repository";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { checkInSchema, relapseSchema } from "./routine.schema";
import { createRoutineRepository, type RoutineRepository } from "./routine.repository";
import { createRoutineService, type RoutineService } from "./routine.service";

export type RoutineRoutesOptions = { config: AppConfig; databaseSource?: DatabaseSource; authRepository?: AuthRepository; authService?: AuthService; routineRepository?: RoutineRepository };

async function withRoutineService<T>(options: RoutineRoutesOptions, action: (service: RoutineService, authService: AuthService) => Promise<T>) {
  if (options.routineRepository && (options.authService || options.authRepository)) {
    const authService = options.authService ?? createAuthService(options.authRepository!, options.config);
    return action(createRoutineService(options.routineRepository), authService);
  }
  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    const authService = createAuthService(createAuthRepository(handle.db), options.config);
    return await action(createRoutineService(createRoutineRepository(handle.db)), authService);
  } finally {
    await handle.close();
  }
}

async function requireAuth(context: any, options: RoutineRoutesOptions, service: AuthService) {
  const middleware = authGuard({ service, config: options.config });
  await middleware(context, async () => undefined);
  return context.get("auth").user;
}

export function createRoutineRoutes(options: RoutineRoutesOptions) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/routine/checkin", async (context) => withRoutineService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, checkInSchema);
    const data = await service.createCheckIn(auth.id, payload);
    return context.json(createSuccessResponse({ message: "Check-in saved successfully", data }), 201);
  }));

  routes.post("/routine/relapses", async (context) => withRoutineService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, relapseSchema);
    const data = await service.createRelapse(auth.id, payload);
    return context.json(createSuccessResponse({ message: "Relapse recorded successfully", data }), 201);
  }));

  routes.get("/routine/statistics", async (context) => withRoutineService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.getStatistics(auth.id);
    return context.json(createSuccessResponse({ message: "Routine statistics retrieved successfully", data }));
  }));

  routes.get("/routine/statistics/activity-summary", async (context) => withRoutineService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.getActivitySummary(auth.id);
    return context.json(createSuccessResponse({ message: "Routine activity summary retrieved successfully", data }));
  }));

  routes.get("/routine/relapses", async (context) => withRoutineService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.listRelapses(auth.id);
    return context.json(createSuccessResponse({ message: "Relapses retrieved successfully", data }));
  }));

  routes.get("/routine/relapses/statistics", async (context) => withRoutineService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.getRelapseStatistics(auth.id);
    return context.json(createSuccessResponse({ message: "Relapse statistics retrieved successfully", data }));
  }));

  return routes;
}
