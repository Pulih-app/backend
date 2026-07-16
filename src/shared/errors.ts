import { HTTPException } from "hono/http-exception";

export const AppErrorCode = {
  ValidationError: "VALIDATION_ERROR",
  BadRequest: "BAD_REQUEST",
  Unauthenticated: "UNAUTHENTICATED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  Conflict: "CONFLICT",
  RateLimited: "RATE_LIMITED",
  DownstreamError: "DOWNSTREAM_ERROR",
  ServiceUnavailable: "SERVICE_UNAVAILABLE",
  InternalError: "INTERNAL_ERROR",
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];

export const ERROR_STATUS_BY_CODE: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  DOWNSTREAM_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details: string[];

  constructor(code: AppErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export type ErrorEnvelope = {
  code: AppErrorCode;
  status: number;
  message: string;
  details: string[];
};

export function mapError(error: unknown): ErrorEnvelope {
  if (error instanceof AppError) {
    return {
      code: error.code,
      status: ERROR_STATUS_BY_CODE[error.code],
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof HTTPException) {
    if (error.status === 404) {
      return {
        code: AppErrorCode.NotFound,
        status: ERROR_STATUS_BY_CODE[AppErrorCode.NotFound],
        message: "Resource not found",
        details: [],
      };
    }

    if (error.status === 401) {
      return {
        code: AppErrorCode.Unauthenticated,
        status: ERROR_STATUS_BY_CODE[AppErrorCode.Unauthenticated],
        message: "Authentication required",
        details: [],
      };
    }

    if (error.status === 403) {
      return {
        code: AppErrorCode.Forbidden,
        status: ERROR_STATUS_BY_CODE[AppErrorCode.Forbidden],
        message: "Access denied",
        details: [],
      };
    }

    return {
      code: AppErrorCode.BadRequest,
      status: error.status,
      message: error.message || "Bad request",
      details: [],
    };
  }

  return {
    code: AppErrorCode.InternalError,
    status: ERROR_STATUS_BY_CODE[AppErrorCode.InternalError],
    message: "Internal server error",
    details: [],
  };
}