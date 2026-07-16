import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type AskCoachInput = { message: string };
export type RelapseSolutionInput = { situation: string; triggers?: string[] };
export type RelapsePreventionPlanInput = { urgeLevel: number; triggers?: string[]; currentContext?: string };
export type OnboardingAnalysisInput = { recoveryGoal?: string; concerns?: string[]; preferredSupport?: string };
export type PersonaPreferencesInput = { tone: "gentle" | "direct" | "balanced"; focusAreas: string[] };

function ensureObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }
  return { ok: true, value: input as Record<string, unknown> } as const;
}

function rejectUnknown(object: Record<string, unknown>, allowed: string[], issues: ValidationIssue[]) {
  for (const key of Object.keys(object)) if (!allowed.includes(key)) issues.push({ field: key, message: "Unknown field is not allowed." });
}

function text(value: unknown, field: string, issues: ValidationIssue[], maxLength: number, required = true) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a string." });
    return "";
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) issues.push({ field, message: "Must not be empty." });
  if (trimmed.length > maxLength) issues.push({ field, message: `Must be at most ${maxLength} characters.` });
  return trimmed;
}

function textArray(value: unknown, field: string, issues: ValidationIssue[], maxItems: number) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push({ field, message: "Must be an array." });
    return undefined;
  }
  if (value.length > maxItems) issues.push({ field, message: `Must contain at most ${maxItems} items.` });
  return value.map((item, index) => text(item, `${field}.${index}`, issues, 120)).filter(Boolean) as string[];
}

export const askCoachSchema: Schema<AskCoachInput> = (input) => {
  const object = ensureObject(input); if (!object.ok) return object;
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["message"], issues);
  const message = text(object.value.message, "message", issues, 2000) ?? "";
  return issues.length ? { ok: false, issues } : { ok: true, value: { message } };
};

export const relapseSolutionSchema: Schema<RelapseSolutionInput> = (input) => {
  const object = ensureObject(input); if (!object.ok) return object;
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["situation", "triggers"], issues);
  const situation = text(object.value.situation, "situation", issues, 2000) ?? "";
  const triggers = textArray(object.value.triggers, "triggers", issues, 10);
  return issues.length ? { ok: false, issues } : { ok: true, value: { situation, triggers } };
};

export const relapsePreventionPlanSchema: Schema<RelapsePreventionPlanInput> = (input) => {
  const object = ensureObject(input); if (!object.ok) return object;
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["urgeLevel", "triggers", "currentContext"], issues);
  const urgeLevel = Number(object.value.urgeLevel);
  if (!Number.isInteger(urgeLevel) || urgeLevel < 1 || urgeLevel > 5) issues.push({ field: "urgeLevel", message: "Must be an integer between 1 and 5." });
  const triggers = textArray(object.value.triggers, "triggers", issues, 10);
  const currentContext = text(object.value.currentContext, "currentContext", issues, 1000, false);
  return issues.length ? { ok: false, issues } : { ok: true, value: { urgeLevel, triggers, currentContext } };
};

export const onboardingAnalysisSchema: Schema<OnboardingAnalysisInput> = (input) => {
  const object = ensureObject(input); if (!object.ok) return object;
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["recoveryGoal", "concerns", "preferredSupport"], issues);
  const recoveryGoal = text(object.value.recoveryGoal, "recoveryGoal", issues, 500, false);
  const concerns = textArray(object.value.concerns, "concerns", issues, 10);
  const preferredSupport = text(object.value.preferredSupport, "preferredSupport", issues, 500, false);
  return issues.length ? { ok: false, issues } : { ok: true, value: { recoveryGoal, concerns, preferredSupport } };
};

export const personaPreferencesSchema: Schema<PersonaPreferencesInput> = (input) => {
  const object = ensureObject(input); if (!object.ok) return object;
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["tone", "focusAreas"], issues);
  const tone = object.value.tone;
  if (!["gentle", "direct", "balanced"].includes(String(tone))) issues.push({ field: "tone", message: "Must be one of gentle, direct, balanced." });
  const focusAreas = textArray(object.value.focusAreas, "focusAreas", issues, 8) ?? [];
  return issues.length ? { ok: false, issues } : { ok: true, value: { tone: tone as PersonaPreferencesInput["tone"], focusAreas } };
};
