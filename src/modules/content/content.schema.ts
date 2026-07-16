import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type JournalInput = { content: string };
export type CommunityPostInput = { title?: string; category: "advice" | "motivation" | "story" | "question" | "help"; content: string };
export type CommunityCommentInput = { content: string };
export type CommunityReplyInput = { content: string };

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

function optionalText(value: unknown, field: string, issues: ValidationIssue[], maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a string." });
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > maxLength) issues.push({ field, message: `Must be at most ${maxLength} characters.` });
  return trimmed;
}

const ALLOWED_POST_CATEGORIES = ["advice", "motivation", "story", "question", "help"] as const;
const ALLOWED_POST_FIELDS = ["title", "category", "content"];

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
  for (const key of Object.keys(object.value)) if (!ALLOWED_POST_FIELDS.includes(key)) issues.push({ field: key, message: "Unknown field is not allowed." });
  const title = optionalText(object.value.title, "title", issues, 120);
  const category = object.value.category;
  if (!ALLOWED_POST_CATEGORIES.includes(String(category) as typeof ALLOWED_POST_CATEGORIES[number])) {
    issues.push({ field: "category", message: "Must be one of advice, motivation, story, question, help." });
  }
  const content = text(object.value.content, "content", issues, 5000);
  if (content.length > 0 && content.length < 10) issues.push({ field: "content", message: "Must be at least 10 characters." });
  if (content.length > 5000) issues.push({ field: "content", message: "Must be at most 5000 characters." });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { ...(title !== undefined ? { title } : {}), category: category as CommunityPostInput["category"], content } };
};

export const communityCommentSchema: Schema<CommunityCommentInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(object.value)) if (key !== "content") issues.push({ field: key, message: "Unknown field is not allowed." });
  const content = text(object.value.content, "content", issues, 2000);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { content } };
};

export const communityReplySchema: Schema<CommunityReplyInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(object.value)) if (key !== "content") issues.push({ field: key, message: "Unknown field is not allowed." });
  const content = text(object.value.content, "content", issues, 2000);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { content } };
};
