import { describe, expect, test } from "bun:test";

import {
  RESPONSE_MESSAGES,
  createErrorResponse,
  createPaginationMeta,
  createSuccessResponse,
} from "../src/shared/response";

describe("response helpers", () => {
  test("creates success envelope", () => {
    const response = createSuccessResponse({
      data: { status: "ok" },
    });

    expect(response).toEqual({
      success: true,
      message: "Request processed successfully",
      data: { status: "ok" },
      meta: null,
    });
  });

  test("creates error envelope", () => {
    const response = createErrorResponse({
      code: "VALIDATION_ERROR",
      requestId: "req_123",
      details: ["Name is required"],
    });

    expect(response).toEqual({
      success: false,
      message: "Request failed",
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        details: ["Name is required"],
        request_id: "req_123",
      },
    });
  });

  test("creates pagination meta", () => {
    expect(createPaginationMeta({ page: 2, limit: 10, total: 21 })).toEqual({
      pagination: {
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      },
    });
  });

  test("keeps messages in English", () => {
    expect(RESPONSE_MESSAGES.requestProcessedSuccessfully).toBe("Request processed successfully");
    expect(RESPONSE_MESSAGES.requestFailed).toBe("Request failed");
  });
});
