import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type CheckInInput = { mood: number; note: string | null; localDate: string | null };
export type RelapseInput = { mood: number; triggers: string[]; note: string | null; localDate: string | null };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function ensureObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }
  return { ok: true, value: input as Record<string, unknown> } as const;
}

function optionalText(value: unknown, field: string, issues: ValidationIssue[], maxLength = 2000) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a string." });
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) issues.push({ field, message: `Must be at most ${maxLength} characters.` });
  return trimmed.length > 0 ? trimmed : null;
}

function optionalLocalDate(value: unknown, issues: ValidationIssue[]) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    issues.push({ field: "localDate", message: "Must be a date in YYYY-MM-DD format." });
    return null;
  }
  return value;
}

function parseMood(value: unknown, issues: ValidationIssue[]) {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5) {
    issues.push({ field: "mood", message: "Mood must be an integer from 1 to 5." });
    return 0;
  }
  return value as number;
}

export const checkInSchema: Schema<CheckInInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(object.value)) {
    if (!["mood", "note", "localDate"].includes(key)) issues.push({ field: key, message: "Unknown field is not allowed." });
  }
  const mood = parseMood(object.value.mood, issues);
  const note = optionalText(object.value.note, "note", issues);
  const localDate = optionalLocalDate(object.value.localDate, issues);
  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { mood, note, localDate } } as const;
};

export const relapseSchema: Schema<RelapseInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];
  for (const key of Object.keys(object.value)) {
    if (!["mood", "triggers", "note", "localDate"].includes(key)) issues.push({ field: key, message: "Unknown field is not allowed." });
  }
  const mood = parseMood(object.value.mood, issues);
  const triggersInput = object.value.triggers;
  const triggers = Array.isArray(triggersInput) ? triggersInput.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean) : [];
  if (!Array.isArray(triggersInput) || triggers.length === 0) issues.push({ field: "triggers", message: "At least one trigger is required." });
  if (triggers.some((item) => item.length > 100)) issues.push({ field: "triggers", message: "Each trigger must be at most 100 characters." });
  const note = optionalText(object.value.note, "note", issues);
  const localDate = optionalLocalDate(object.value.localDate, issues);
  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { mood, triggers, note, localDate } } as const;
};
