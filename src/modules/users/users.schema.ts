import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type UserSettingsInput = {
  displayName?: string | null;
  nickname?: string | null;
  recoveryGoal?: string | null;
  checkInTime?: string | null;
};

export type OnboardingInput = {
  displayName?: string | null;
  nickname?: string | null;
  recoveryGoal: string;
  checkInTime?: string | null;
};

const SETTINGS_FIELDS = ["displayName", "nickname", "recoveryGoal", "checkInTime"] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

type FieldName = typeof SETTINGS_FIELDS[number];

function ensureObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }

  return { ok: true, value: input as Record<string, unknown> } as const;
}

function rejectUnknownFields(value: Record<string, unknown>, allowed: readonly string[], issues: ValidationIssue[]) {
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) {
      issues.push({ field, message: "Unknown field is not allowed." });
    }
  }
}

function parseOptionalText(value: unknown, field: FieldName, maxLength: number, issues: ValidationIssue[]) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a string or null." });
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    issues.push({ field, message: `Must be at most ${maxLength} characters.` });
  }

  return normalized.length > 0 ? normalized : null;
}

function parseOptionalTime(value: unknown, issues: ValidationIssue[]) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    issues.push({ field: "checkInTime", message: "Must be a HH:mm time string or null." });
    return undefined;
  }

  const normalized = value.trim();
  if (!TIME_PATTERN.test(normalized)) {
    issues.push({ field: "checkInTime", message: "Must use HH:mm format." });
    return undefined;
  }

  return normalized.length === 5 ? `${normalized}:00` : normalized;
}

function parseSettings(input: unknown, requireRecoveryGoal: boolean) {
  const object = ensureObject(input);
  if (!object.ok) {
    return object;
  }

  const value = object.value;
  const issues: ValidationIssue[] = [];
  rejectUnknownFields(value, SETTINGS_FIELDS, issues);

  const settings: UserSettingsInput = {
    displayName: parseOptionalText(value.displayName, "displayName", 255, issues),
    nickname: parseOptionalText(value.nickname, "nickname", 255, issues),
    recoveryGoal: parseOptionalText(value.recoveryGoal, "recoveryGoal", 2000, issues),
    checkInTime: parseOptionalTime(value.checkInTime, issues),
  };

  if (requireRecoveryGoal && !settings.recoveryGoal) {
    issues.push({ field: "recoveryGoal", message: "Recovery goal is required." });
  }

  const provided = Object.values(settings).some((field) => field !== undefined);
  if (!provided) {
    issues.push({ field: "body", message: "At least one field must be provided." });
  }

  if (issues.length > 0) {
    return { ok: false, issues } as const;
  }

  return { ok: true, value: settings } as const;
}

export const userSettingsSchema: Schema<UserSettingsInput> = (input) => parseSettings(input, false);
export const onboardingSchema: Schema<OnboardingInput> = (input) => {
  const parsed = parseSettings(input, true);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, value: parsed.value as OnboardingInput };
};
