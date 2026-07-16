export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "DOWNSTREAM_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type ApiErrorDetail = {
  field?: string;
  message: string;
};

export type ApiErrorShape = {
  code: ApiErrorCode;
  details: ApiErrorDetail[];
  request_id: string;
};

const ERROR_STATUS: Record<ApiErrorCode, number> = {
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

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details: ApiErrorDetail[];
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = ERROR_STATUS[code];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorStatus(code: ApiErrorCode): number {
  return ERROR_STATUS[code];
}

export function toErrorShape(error: ApiError, requestId: string): ApiErrorShape {
  return {
    code: error.code,
    details: error.details,
    request_id: requestId,
  };
}