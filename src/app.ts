import { Hono } from "hono";
import type { Context } from "hono";

import { mapError } from "./shared/errors";
import { createErrorResponse, createSuccessResponse } from "./shared/response";

const requestIdHeader = "x-request-id";

export function handleGlobalError(error: Error, c: Context) {
  const mapped = mapError(error);
  const requestId = c.req.header(requestIdHeader)?.trim() || crypto.randomUUID();

  return c.json(
    createErrorResponse({
      code: mapped.code,
      requestId,
      message: mapped.message,
      details: mapped.details,
    }),
    mapped.status,
  );
}

export function createApp() {
  const app = new Hono();

  app.onError(handleGlobalError);

  app.get("/health/live", (c) => {
    return c.json(
      createSuccessResponse({
        message: "Service is live",
        data: {
          status: "ok",
        },
      }),
    );
  });

  return app;
}

export const app = createApp();
