import { Hono } from "hono";
import { createSuccessResponse } from "../shared/response";
import { validateJsonBody } from "../shared/http/validation";

export type ValidationDemoInput = {
  name: string;
  email?: string;
};

const validationDemoSchema = (input: unknown) => {
  const issues: { field: string; message: string }[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }

  const value = input as Record<string, unknown>;
  const name = value.name;
  const email = value.email;

  if (typeof name !== "string" || name.trim().length === 0) {
    issues.push({ field: "name", message: "Name is required." });
  }

  if (email !== undefined && typeof email !== "string") {
    issues.push({ field: "email", message: "Email must be a string." });
  }

  if (issues.length > 0) {
    return { ok: false, issues } as const;
  }

  const validName = typeof name === "string" ? name.trim() : "";
  const validEmail = typeof email === "string" ? email.trim() : undefined;

  return {
    ok: true,
    value: {
      name: validName,
      email: validEmail,
    },
  } as const;
};

export const validationDemoRoutes = new Hono();

validationDemoRoutes.post("/validation-demo", async (context) => {
  const payload = await validateJsonBody(context, validationDemoSchema);

  return context.json(
    createSuccessResponse({
      data: {
        received: payload,
      },
    }),
  );
});