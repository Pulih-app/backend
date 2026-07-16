import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type CheckInInput = {
  mood: string;
  isSuccessful: boolean;
  commitment: string | null;
  localDate: string | null;
};

export type RelapseInput = {
  mood: string;
  triggers: string[];
  commitment: string | null;
  localDate: string | null;
};

export type ActivitySummaryQuery = {
  windowDays: number;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MOOD_LENGTH = 50;
const MAX_COMMITMENT_LENGTH = 2000;
const MAX_TRIGGER_LENGTH = 500;
const MAX_WINDOW_DAYS = 90;
const MIN_WINDOW_DAYS = 7;
const DEFAULT_WINDOW_DAYS = 30;

function ensureObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }
  return { ok: true, value: input as Record<string, unknown> } as const;
}

function parseMood(value: unknown, issues: ValidationIssue[]): string {
  if (typeof value !== "string") {
    issues.push({ field: "mood", message: "Mood must be a string." });
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    issues.push({ field: "mood", message: "Mood is required." });
    return "";
  }
  if (trimmed.length > MAX_MOOD_LENGTH) {
    issues.push({ field: "mood", message: `Mood must be at most ${MAX_MOOD_LENGTH} characters.` });
  }
  return trimmed;
}

function parseCommitment(body: Record<string, unknown>, issues: ValidationIssue[]): string | null {
  const commitment = body.commitment;
  const content = body.content;

  // content is alias for commitment
  const raw = commitment !== undefined ? commitment : content;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    issues.push({ field: "commitment", message: "Commitment must be a string." });
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_COMMITMENT_LENGTH) {
    issues.push({ field: "commitment", message: `Commitment must be at most ${MAX_COMMITMENT_LENGTH} characters.` });
  }
  return trimmed;
}

function optionalLocalDate(value: unknown, issues: ValidationIssue[]): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    issues.push({ field: "localDate", message: "Must be a date in YYYY-MM-DD format." });
    return null;
  }
  return value;
}

function parseRelapseTriggers(value: unknown, issues: ValidationIssue[]): string[] {
  if (!Array.isArray(value)) {
    issues.push({ field: "relapse_trigger", message: "Must be an array of trigger strings." });
    return [];
  }
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.length > MAX_TRIGGER_LENGTH) {
      issues.push({ field: "relapse_trigger", message: `Each trigger must be at most ${MAX_TRIGGER_LENGTH} characters.` });
    }
    normalized.push(trimmed);
  }
  if (normalized.length === 0) {
    issues.push({ field: "relapse_trigger", message: "At least one relapse trigger is required." });
  }
  return normalized;
}

export const checkInSchema: Schema<CheckInInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];

  const allowed = new Set(["mood", "is_successful", "commitment", "content", "localDate"]);
  for (const key of Object.keys(object.value)) {
    if (!allowed.has(key)) issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  // reject relapse_trigger on check-in endpoint
  if (object.value.relapse_trigger !== undefined) {
    issues.push({ field: "relapse_trigger", message: "Use /api/v1/routine/relapses for relapse_trigger." });
  }

  const mood = parseMood(object.value.mood, issues);

  if (object.value.is_successful === undefined || object.value.is_successful === null) {
    issues.push({ field: "is_successful", message: "is_successful is required." });
  } else if (typeof object.value.is_successful !== "boolean") {
    issues.push({ field: "is_successful", message: "is_successful must be a boolean." });
  } else if (!object.value.is_successful) {
    issues.push({ field: "is_successful", message: "Use /api/v1/routine/relapses if this is a relapse." });
  }

  const commitment = parseCommitment(object.value, issues);
  const localDate = optionalLocalDate(object.value.localDate, issues);

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { mood, isSuccessful: true, commitment, localDate } } as const;
};

export const relapseSchema: Schema<RelapseInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const issues: ValidationIssue[] = [];

  const allowed = new Set(["mood", "relapse_trigger", "commitment", "content", "localDate"]);
  for (const key of Object.keys(object.value)) {
    if (!allowed.has(key)) issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  const mood = parseMood(object.value.mood, issues);
  const triggers = parseRelapseTriggers(object.value.relapse_trigger, issues);
  const commitment = parseCommitment(object.value, issues);
  const localDate = optionalLocalDate(object.value.localDate, issues);

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { mood, triggers, commitment, localDate } } as const;
};

export function normalizeActivitySummaryWindow(raw: unknown): { ok: boolean; value: number; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (raw === undefined || raw === null) {
    return { ok: true, value: DEFAULT_WINDOW_DAYS, issues: [] };
  }
  const num = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  if (!Number.isInteger(num)) {
    issues.push({ field: "window_days", message: "window_days must be an integer." });
    return { ok: false, value: DEFAULT_WINDOW_DAYS, issues };
  }
  if (num < MIN_WINDOW_DAYS) {
    issues.push({ field: "window_days", message: `window_days must be at least ${MIN_WINDOW_DAYS}.` });
    return { ok: false, value: DEFAULT_WINDOW_DAYS, issues };
  }
  if (num > MAX_WINDOW_DAYS) {
    issues.push({ field: "window_days", message: `window_days must be at most ${MAX_WINDOW_DAYS}.` });
    return { ok: false, value: DEFAULT_WINDOW_DAYS, issues };
  }
  return { ok: true, value: num, issues: [] };
}
