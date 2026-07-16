export const RESPONSE_MESSAGES = {
  requestProcessedSuccessfully: "Request processed successfully",
  requestFailed: "Request failed",
  serviceIsLive: "Service is live",
  serviceIsReady: "Service is ready",
} as const;

export type PaginationEnvelope = {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export function createSuccessResponse<T>(input: {
  data: T;
  message?: string;
  meta?: Record<string, unknown> | null;
}) {
  return {
    success: true,
    message: input.message ?? RESPONSE_MESSAGES.requestProcessedSuccessfully,
    data: input.data,
    meta: input.meta ?? null,
  };
}

export function createErrorResponse(input: {
  code: string;
  requestId: string;
  details: string[];
  message?: string;
}) {
  return {
    success: false,
    message: input.message ?? RESPONSE_MESSAGES.requestFailed,
    data: null,
    error: {
      code: input.code,
      details: input.details,
      request_id: input.requestId,
    },
  };
}

export function createPaginationMeta(input: { page: number; limit: number; total: number }): PaginationEnvelope {
  const totalPages = Math.max(1, Math.ceil(input.total / input.limit));

  return {
    pagination: {
      page: input.page,
      limit: input.limit,
      total: input.total,
      totalPages,
      hasNextPage: input.page < totalPages,
      hasPrevPage: input.page > 1,
    },
  };
}