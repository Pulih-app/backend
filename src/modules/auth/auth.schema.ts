import type { Schema } from "../../shared/http/validation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,50}$/;

export type RegisterInput = {
  email: string;
  username: string;
  password: string;
  confirm_password: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export const registerSchema: Schema<RegisterInput> = (input) => {
  const issues: { field: string; message: string }[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }

  const value = input as Record<string, unknown>;

  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) {
    issues.push({ field: "email", message: "Email must be valid." });
  }

  const username = typeof value.username === "string" ? value.username.trim().toLowerCase() : "";
  if (!USERNAME_PATTERN.test(username)) {
    issues.push({ field: "username", message: "Username must be 3-50 lowercase alphanumeric characters or underscores." });
  }

  const password = typeof value.password === "string" ? value.password : "";
  if (password.length === 0) {
    issues.push({ field: "password", message: "Password is required." });
  }

  const confirmPassword = typeof value.confirm_password === "string" ? value.confirm_password : "";
  if (confirmPassword !== password) {
    issues.push({ field: "confirm_password", message: "Passwords do not match." });
  }

  if (issues.length > 0) {
    return { ok: false, issues } as const;
  }

  return { ok: true, value: { email, username, password, confirm_password: confirmPassword } } as const;
};

export const loginSchema: Schema<LoginInput> = (input) => {
  const issues: { field: string; message: string }[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }

  const value = input as Record<string, unknown>;
  const identifier = typeof value.identifier === "string" ? value.identifier.trim().toLowerCase() : "";
  const password = typeof value.password === "string" ? value.password : "";

  if (identifier.length === 0) {
    issues.push({ field: "identifier", message: "Identifier is required." });
  }

  if (password.length === 0) {
    issues.push({ field: "password", message: "Password is required." });
  }

  if (issues.length > 0) {
    return { ok: false, issues } as const;
  }

  return { ok: true, value: { identifier, password } } as const;
};
