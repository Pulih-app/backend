import type { ApiErrorShape } from "./errors";

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type Envelope<T> = {
  success: true;
  message: string;
  data: T;
  meta: { pagination: PaginationMeta } | null;
};

export type ErrorEnvelope = {
  success: false;
  message: string;
  data: null;
  error: ApiErrorShape;
};

export function successResponse<T>(message: string, data: T, meta: Envelope<T>["meta"] = null): Envelope<T> {
  return { success: true, message, data, meta };
}

export function errorResponse(message: string, error: ApiErrorShape): ErrorEnvelope {
  return { success: false, message, data: null, error };
}

export function buildPaginationMeta(input: {
  page: number;
  limit: number;
  total: number;
}): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(input.total / input.limit));

  return {
    page: input.page,
    limit: input.limit,
    total: input.total,
    totalPages,
    hasNextPage: input.page < totalPages,
    hasPrevPage: input.page > 1,
  };
}