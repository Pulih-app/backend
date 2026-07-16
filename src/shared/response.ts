export type ResponseMeta = Record<string, unknown> | null;

export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta: ResponseMeta;
}

export interface ErrorEnvelope {
  success: false;
  message: string;
  data: null;
  error: {
    code: string;
    details: string[];
    request_id: string;
  };
}

export interface PaginationMeta {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const RESPONSE_MESSAGES = {
  requestProcessedSuccessfully: "Request processed successfully",
  requestFailed: "Request failed",
} as const;

export function createSuccessResponse<T>(options: {
  data: T;
  message?: string;
  meta?: ResponseMeta;
}): SuccessEnvelope<T> {
  return {
    success: true,
    message: options.message ?? RESPONSE_MESSAGES.requestProcessedSuccessfully,
    data: options.data,
    meta: options.meta ?? null,
  };
}

export function createErrorResponse(options: {
  code: string;
  requestId: string;
  message?: string;
  details?: string[];
}): ErrorEnvelope {
  return {
    success: false,
    message: options.message ?? RESPONSE_MESSAGES.requestFailed,
    data: null,
    error: {
      code: options.code,
      details: options.details ?? [],
      request_id: options.requestId,
    },
  };
}

export function createPaginationMeta(options: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta {
  const totalPages = options.limit > 0 ? Math.ceil(options.total / options.limit) : 0;

  return {
    pagination: {
      page: options.page,
      limit: options.limit,
      total: options.total,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPrevPage: options.page > 1 && totalPages > 0,
    },
  };
}
