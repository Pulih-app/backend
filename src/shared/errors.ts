import { HTTPException } from "hono/http-exception";

export enum AppErrorCode {
  BadRequest = "BAD_REQUEST",
  ValidationError = "VALIDATION_ERROR",
  Unauthenticated = "UNAUTHENTICATED",
  Forbidden = "FORBIDDEN",
  NotFound = "NOT_FOUND",
  Conflict = "CONFLICT",
  RateLimited = "RATE_LIMITED",
  DownstreamError = "DOWNSTREAM_ERROR",
  ServiceUnavailable = "SERVICE_UNAVAILABLE",
  InternalError = "INTERNAL_ERROR",
}

export type AppErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;

export const ERROR_STATUS_BY_CODE: Record<AppErrorCode, AppErrorStatus> = {
  [AppErrorCode.BadRequest]: 400,
  [AppErrorCode.ValidationError]: 422,
  [AppErrorCode.Unauthenticated]: 401,
  [AppErrorCode.Forbidden]: 403,
  [AppErrorCode.NotFound]: 404,
  [AppErrorCode.Conflict]: 409,
  [AppErrorCode.RateLimited]: 429,
  [AppErrorCode.DownstreamError]: 502,
  [AppErrorCode.ServiceUnavailable]: 503,
  [AppErrorCode.InternalError]: 500,
};

const DEFAULT_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  [AppErrorCode.BadRequest]: "Bad request",
  [AppErrorCode.ValidationError]: "Validation failed",
  [AppErrorCode.Unauthenticated]: "Authentication required",
  [AppErrorCode.Forbidden]: "Access denied",
  [AppErrorCode.NotFound]: "Resource not found",
  [AppErrorCode.Conflict]: "Conflict detected",
  [AppErrorCode.RateLimited]: "Too many requests",
  [AppErrorCode.DownstreamError]: "Downstream service error",
  [AppErrorCode.ServiceUnavailable]: "Service unavailable",
  [AppErrorCode.InternalError]: "Internal server error",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details: string[];

  constructor(code: AppErrorCode, message?: string, details: string[] = []) {
    super(message?.trim() || DEFAULT_ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export interface ErrorMapping {
  code: AppErrorCode;
  status: AppErrorStatus;
  message: string;
  details: string[];
}

export function mapError(error: unknown): ErrorMapping {
  if (error instanceof AppError) {
    return {
      code: error.code,
      status: ERROR_STATUS_BY_CODE[error.code],
      message: error.message || DEFAULT_ERROR_MESSAGES[error.code],
      details: error.details,
    };
  }

  if (error instanceof HTTPException) {
    const code = codeFromStatus(error.status);

    return {
      code,
      status: ERROR_STATUS_BY_CODE[code],
      message: DEFAULT_ERROR_MESSAGES[code],
      details: [],
    };
  }

  return {
    code: AppErrorCode.InternalError,
    status: ERROR_STATUS_BY_CODE[AppErrorCode.InternalError],
    message: DEFAULT_ERROR_MESSAGES[AppErrorCode.InternalError],
    details: [],
  };
}

function codeFromStatus(status: number): AppErrorCode {
  switch (status) {
    case 400:
      return AppErrorCode.BadRequest;
    case 401:
      return AppErrorCode.Unauthenticated;
    case 403:
      return AppErrorCode.Forbidden;
    case 404:
      return AppErrorCode.NotFound;
    case 409:
      return AppErrorCode.Conflict;
    case 422:
      return AppErrorCode.ValidationError;
    case 429:
      return AppErrorCode.RateLimited;
    case 502:
      return AppErrorCode.DownstreamError;
    case 503:
      return AppErrorCode.ServiceUnavailable;
    default:
      return status >= 500 ? AppErrorCode.InternalError : AppErrorCode.BadRequest;
  }
}
