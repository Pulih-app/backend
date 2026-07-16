import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type JournalInput = { content: string };
export type CommunityPostInput = { category: "general" | "support" | "progress"; content: string };
export type CommunityCommentInput = { content: string };

function ensureObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }
  return { ok: true, value: input as Record<string, unknown> } as const;
}

function text(value: unknown, field: string, issues: ValidationIssue[], maxLength: number) {
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a string." });
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) issues.push({ field, message: "Must not be empty." });
  if (trimmed.length > maxLength) issues.push({ field, message: `Must be at most ${maxLength} characters.` });
  return trimmed;
}

export const journalSchema: Schema<JournalInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(object.value)) if (key !== "content") issues.push({ field: key, message: "Unknown field is not allowed." });
  const content = text(object.value.content, "content", issues, 5000);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { content } };
};

export const communityPostSchema: Schema<CommunityPostInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(object.value)) if (!["category", "content"].includes(key)) issues.push({ field: key, message: "Unknown field is not allowed." });
  const category = object.value.category;
  if (!["general", "support", "progress"].includes(String(category))) issues.push({ field: "category", message: "Must be one of general, support, progress." });
  const content = text(object.value.content, "content", issues, 2000);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { category: category as CommunityPostInput["category"], content } };
};

export const communityCommentSchema: Schema<CommunityCommentInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(object.value)) if (key !== "content") issues.push({ field: key, message: "Unknown field is not allowed." });
  const content = text(object.value.content, "content", issues, 1000);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { content } };
};
