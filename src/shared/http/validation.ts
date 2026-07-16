import type { Context } from "hono";
import { AppError, AppErrorCode } from "../errors";

export type ValidationIssue = {
  field: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly ValidationIssue[] };

export type Schema<T> = (input: unknown) => ValidationResult<T>;

function normalizeIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.length > 0 ? [...issues] : [{ field: "request", message: "Request payload is invalid." }];
}

function raiseValidationError(issues: readonly ValidationIssue[]): never {
  throw new AppError(
    AppErrorCode.ValidationError,
    "Request validation failed.",
    normalizeIssues(issues).map((issue) => `${issue.field}: ${issue.message}`),
  );
}

export function validateValue<T>(input: unknown, schema: Schema<T>): T {
  const result = schema(input);

  if (!result.ok) {
    raiseValidationError(result.issues);
  }

  return result.value;
}

export async function validateJsonBody<T>(context: Context, schema: Schema<T>): Promise<T> {
  let body: unknown;

  try {
    body = await context.req.json();
  } catch {
    raiseValidationError([{ field: "body", message: "Request body must be valid JSON." }]);
  }

  return validateValue(body, schema);
}

export function validateQuery<T>(context: Context, schema: Schema<T>): T {
  return validateValue(context.req.query(), schema);
}

export function validateParams<T>(context: Context, schema: Schema<T>): T {
  return validateValue(context.req.param(), schema);
}