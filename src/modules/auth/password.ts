import bcrypt from "bcryptjs";
import { AppError, AppErrorCode } from "../../shared/errors";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

export function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(AppErrorCode.ValidationError, "Password validation failed.", [
      "password: Password must be at least 8 characters.",
    ]);
  }

  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    throw new AppError(AppErrorCode.ValidationError, "Password validation failed.", [
      "password: Password must be at most 72 bytes.",
    ]);
  }
}

export async function hashPassword(password: string, cost: number) {
  validatePassword(password);
  return bcrypt.hash(password, cost);
}

export async function verifyPassword(password: string, hash: string) {
  if (!hash) {
    return false;
  }

  return bcrypt.compare(password, hash);
}
