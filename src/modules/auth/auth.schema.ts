import type { Schema } from "../../shared/http/validation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterInput = {
  email: string;
  password: string;
};

export type LoginInput = RegisterInput;

function parseAuthInput(input: unknown, label: string) {
  const issues: { field: string; message: string }[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }

  const value = input as Record<string, unknown>;
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const password = typeof value.password === "string" ? value.password : "";

  if (!EMAIL_PATTERN.test(email)) {
    issues.push({ field: "email", message: "Email must be valid." });
  }

  if (password.length === 0) {
    issues.push({ field: "password", message: "Password is required." });
  }

  if (issues.length > 0) {
    return { ok: false, issues } as const;
  }

  return { ok: true, value: { email, password } } as const;
}

export const registerSchema: Schema<RegisterInput> = (input) => parseAuthInput(input, "register");
export const loginSchema: Schema<LoginInput> = (input) => parseAuthInput(input, "login");
