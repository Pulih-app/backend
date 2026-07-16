import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { handleGlobalError } from "../src/app";
import { AppError, AppErrorCode, ERROR_STATUS_BY_CODE, mapError } from "../src/shared/errors";

function createErrorTestApp() {
  const testApp = new Hono();

  testApp.onError(handleGlobalError);

  testApp.get("/error/app", () => {
    throw new AppError(AppErrorCode.ValidationError, "Validation failed", ["Name is required"]);
  });

  testApp.get("/error/internal", () => {
    throw new Error("unexpected failure");
  });

  return testApp;
}

describe("error taxonomy", () => {
  test("maps app error to safe response metadata", () => {
    const error = new AppError(AppErrorCode.Conflict, "Conflict detected", ["Slot already booked"]);

    expect(mapError(error)).toEqual({
      code: AppErrorCode.Conflict,
      status: ERROR_STATUS_BY_CODE[AppErrorCode.Conflict],
      message: "Conflict detected",
      details: ["Slot already booked"],
    });
  });

  test("maps Hono HTTP exception to safe default message", () => {
    expect(mapError(new HTTPException(404, { message: "raw route text" }))).toEqual({
      code: AppErrorCode.NotFound,
      status: ERROR_STATUS_BY_CODE[AppErrorCode.NotFound],
      message: "Resource not found",
      details: [],
    });
  });

  test("maps unknown error to internal error", () => {
    expect(mapError(new Error("raw database failure"))).toEqual({
      code: AppErrorCode.InternalError,
      status: ERROR_STATUS_BY_CODE[AppErrorCode.InternalError],
      message: "Internal server error",
      details: [],
    });
  });
});

describe("global error handler", () => {
  test("returns safe error envelope with request id", async () => {
    const testApp = createErrorTestApp();

    const response = await testApp.fetch(
      new Request("http://localhost/error/app", {
        headers: {
          "x-request-id": "req_error_123",
        },
      }),
    );

    expect(response.status).toBe(422);

    const body = (await response.json()) as {
      success: boolean;
      message: string;
      data: null;
      error: { code: string; details: string[]; request_id: string };
    };
    expect(body).toEqual({
      success: false,
      message: "Validation failed",
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        details: ["Name is required"],
        request_id: "req_error_123",
      },
    });
  });

  test("maps unknown error to internal error envelope", async () => {
    const testApp = createErrorTestApp();

    const response = await testApp.fetch(new Request("http://localhost/error/internal"));

    expect(response.status).toBe(500);

    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; request_id: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.request_id).toBeTruthy();
  });
});
