import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { loadConfig } from "./shared/config";
import {
  AppError,
  AppErrorCode,
  ERROR_STATUS_BY_CODE,
  mapError,
} from "./shared/errors";
import {
  RESPONSE_MESSAGES,
  createErrorResponse,
  createSuccessResponse,
} from "./shared/response";
import { validationDemoRoutes } from "./routes/validation-demo.routes";
import { requestBaseline } from "./shared/middleware/request-baseline";

const DEFAULT_ENV = {
  APP_NAME: "pulih-api",
  APP_ENV: "local",
  NODE_ENV: "development",
  PORT: "3000",
  API_PREFIX: "/api/v1",
  APP_URL: "http://localhost:3000",
  PWA_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  JWT_ACCESS_SECRET: "replace-with-strong-secret",
  JWT_ACCESS_TTL_SECONDS: "86400",
  PASSWORD_HASH_COST: "10",
  CORS_ALLOWED_ORIGINS: "http://localhost:3001,http://localhost:4173",
  REQUEST_ID_HEADER: "x-request-id",
} as const;

function buildApp(env: Record<string, string | undefined> = DEFAULT_ENV) {
  const app = new Hono<{ Variables: { requestId: string } }>();
  const config = loadConfig(env);

  app.use("*", requestBaseline({
    allowedOrigins: config.security.corsAllowedOrigins,
    requestIdHeader: config.security.requestIdHeader,
    bodyLimitBytes: 1024 * 1024,
  }));

  app.get("/health/live", (context) => {
    return context.json(
      createSuccessResponse({
        message: RESPONSE_MESSAGES.serviceIsLive,
        data: {
          status: "ok",
        },
      }),
    );
  });

  app.route("/api/v1", validationDemoRoutes);
  app.onError(handleGlobalError);

  return app;
}

export function handleGlobalError(error: Error | HTTPException | unknown, context: any) {
  const requestId = context.get("requestId") || context.req.header("x-request-id") || crypto.randomUUID();
  const mapped = mapError(error);

  return context.json(
    createErrorResponse({
      code: mapped.code,
      requestId,
      details: mapped.details,
      message: mapped.message,
    }),
    mapped.status,
  );
}

export const app = buildApp(DEFAULT_ENV);

export function createApp(env: Record<string, string | undefined> = DEFAULT_ENV) {
  return buildApp(env);
}
