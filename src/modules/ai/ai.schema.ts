import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type AskCoachInput = { message: string };
export type RelapseSolutionInput = { mood: string; relapse_trigger?: string[]; commitment?: string };
export type RelapsePreventionPlanInput = { urgeLevel: number; triggers?: string[]; currentContext?: string };
export type OnboardingAnalysisInput = { answers: Record<string, unknown> };
export type PersonaPreferencesInput = { persona: "supportive" | "friendly" | "concise" | "direct" };

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

function textArray(value: unknown, field: string, issues: ValidationIssue[], maxItems: number, maxItemLength: number = 120) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    issues.push({ field, message: "Must be an array." });
    return undefined;
  }
  if (value.length > maxItems) issues.push({ field, message: `Must contain at most ${maxItems} items.` });
  return value.map((item, index) => text(item, `${field}.${index}`, issues, maxItemLength)).filter(Boolean) as string[];
}

const ALLOWED_PERSONAS = ["supportive", "friendly", "concise", "direct"] as const;

export const askCoachSchema: Schema<AskCoachInput> = (input) => {
  const object = ensureObject(input); if (!object.ok) return object;
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["message"], issues);
  const message = text(object.value.message, "message", issues, 4000) ?? "";
  return issues.length ? { ok: false, issues } : { ok: true, value: { message } };
};

export const relapseSolutionSchema: Schema<RelapseSolutionInput> = (input) => {
  const object = ensureObject(input); if (!object.ok) return object;
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["mood", "relapse_trigger", "commitment"], issues);
  const mood = text(object.value.mood, "mood", issues, 50) ?? "";
  const relapseTrigger = textArray(object.value.relapse_trigger, "relapse_trigger", issues, 10, 500);
  const commitment = text(object.value.commitment, "commitment", issues, 4000, false);
  return issues.length ? { ok: false, issues } : { ok: true, value: { mood, relapse_trigger: relapseTrigger, commitment } };
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
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["answers"], issues);
  const answers = object.value.answers;
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    issues.push({ field: "answers", message: "Must be a non-empty object." });
  } else if (Object.keys(answers as Record<string, unknown>).length === 0) {
    issues.push({ field: "answers", message: "Must not be empty." });
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: { answers: answers as Record<string, unknown> } };
};

export const personaPreferencesSchema: Schema<PersonaPreferencesInput> = (input) => {
  const object = ensureObject(input); if (!object.ok) return object;
  const issues: ValidationIssue[] = []; rejectUnknown(object.value, ["persona"], issues);
  const persona = object.value.persona;
  if (!ALLOWED_PERSONAS.includes(persona as any)) issues.push({ field: "persona", message: "Must be one of supportive, friendly, concise, direct." });
  return issues.length ? { ok: false, issues } : { ok: true, value: { persona: persona as PersonaPreferencesInput["persona"] } };
};
