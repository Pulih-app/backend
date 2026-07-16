import { Hono } from "hono";
import { createSuccessResponse, RESPONSE_MESSAGES } from "../shared/response";

export type HealthDependencies = {
  checkDatabase: () => Promise<void>;
};

export function createHealthRoutes(dependencies: HealthDependencies) {
  const routes = new Hono();

  routes.get("/ready", async (context) => {
    await dependencies.checkDatabase();

    return context.json(
      createSuccessResponse({
        message: RESPONSE_MESSAGES.serviceIsReady,
        data: {
          status: "ok",
        },
      }),
    );
  });

  return routes;
}
