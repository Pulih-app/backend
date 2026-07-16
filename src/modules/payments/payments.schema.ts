import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type PakasirWebhookInput = {
  project: string;
  orderId: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  completedAt: string | null;
};

function ensureObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }
  return { ok: true, value: input as Record<string, unknown> } as const;
}

export const pakasirWebhookSchema: Schema<PakasirWebhookInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;

  const issues: ValidationIssue[] = [];
  const value = object.value;
  const allowed = new Set(["project", "order_id", "amount", "status", "payment_method", "completed_at"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  const project = value.project;
  const orderId = value.order_id;
  const amount = value.amount;
  const status = value.status;
  const paymentMethod = value.payment_method;
  const completedAt = value.completed_at;

  if (typeof project !== "string" || project.trim().length === 0) issues.push({ field: "project", message: "Project is required." });
  if (typeof orderId !== "string" || orderId.trim().length === 0) issues.push({ field: "order_id", message: "Order id is required." });
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) issues.push({ field: "amount", message: "Amount must be a positive number." });
  if (typeof status !== "string" || status.trim().length === 0) issues.push({ field: "status", message: "Status is required." });
  if (paymentMethod !== undefined && paymentMethod !== null && typeof paymentMethod !== "string") issues.push({ field: "payment_method", message: "Payment method must be a string." });
  if (completedAt !== undefined && completedAt !== null && (typeof completedAt !== "string" || Number.isNaN(Date.parse(completedAt)))) {
    issues.push({ field: "completed_at", message: "Completed at must be a valid date." });
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      project: (project as string).trim(),
      orderId: (orderId as string).trim(),
      amount: Math.round(amount as number),
      status: (status as string).trim(),
      paymentMethod: typeof paymentMethod === "string" ? paymentMethod : null,
      completedAt: typeof completedAt === "string" ? completedAt : null,
    },
  };
};
