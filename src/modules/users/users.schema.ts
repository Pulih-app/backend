import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type UserSettingsInput = {
  nickname?: string | null;
  recovery_reason?: string | null;
  daily_checkin_time?: string | null;
  porn_free_goal?: number | null;
};

export type OnboardingInput = {
  nickname: string;
  recovery_reason: string;
  daily_checkin_time: string;
  porn_free_goal: number;
  answers?: Record<string, unknown> | null;
  dependency_level?: string | null;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function parseOptionalText(value: unknown, field: string, maxLength: number, issues: ValidationIssue[]) {
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

function parseRequiredText(value: unknown, field: string, maxLength: number, minLength: number, issues: ValidationIssue[]) {
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a string." });
    return "";
  }

  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    issues.push({ field, message: `Must be ${minLength}-${maxLength} characters.` });
  }

  return normalized;
}

function parseOptionalTime(value: unknown, issues: ValidationIssue[]) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    issues.push({ field: "daily_checkin_time", message: "Must be a HH:mm time string or null." });
    return undefined;
  }

  const normalized = value.trim();
  if (!TIME_PATTERN.test(normalized)) {
    issues.push({ field: "daily_checkin_time", message: "Must use HH:mm format." });
    return undefined;
  }

  return normalized;
}

function parseRequiredTime(value: unknown, issues: ValidationIssue[]) {
  if (typeof value !== "string") {
    issues.push({ field: "daily_checkin_time", message: "Must be a HH:mm time string." });
    return "";
  }

  const normalized = value.trim();
  if (!TIME_PATTERN.test(normalized)) {
    issues.push({ field: "daily_checkin_time", message: "Must use HH:mm format." });
    return normalized;
  }

  return normalized;
}

function parseOptionalInt(value: unknown, field: string, min: number, max: number, issues: ValidationIssue[]) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    issues.push({ field, message: `Must be an integer between ${min} and ${max} or null.` });
    return undefined;
  }

  return value;
}

function parseRequiredInt(value: unknown, field: string, min: number, max: number, issues: ValidationIssue[]) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    issues.push({ field, message: `Must be an integer between ${min} and ${max}.` });
    return 0;
  }

  return value;
}

const SETTINGS_ALLOWED = ["nickname", "recovery_reason", "daily_checkin_time", "porn_free_goal"] as const;

export const userSettingsSchema: Schema<UserSettingsInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) {
    return object;
  }

  const value = object.value;
  const issues: ValidationIssue[] = [];
  rejectUnknownFields(value, SETTINGS_ALLOWED, issues);

  const settings: UserSettingsInput = {
    nickname: parseOptionalText(value.nickname, "nickname", 255, issues),
    recovery_reason: parseOptionalText(value.recovery_reason, "recovery_reason", 2000, issues),
    daily_checkin_time: parseOptionalTime(value.daily_checkin_time, issues),
    porn_free_goal: parseOptionalInt(value.porn_free_goal, "porn_free_goal", 1, 3650, issues),
  };

  const provided = Object.values(settings).some((field) => field !== undefined);
  if (!provided) {
    issues.push({ field: "body", message: "At least one field must be provided." });
  }

  if (issues.length > 0) {
    return { ok: false, issues } as const;
  }

  return { ok: true, value: settings } as const;
};

const ONBOARDING_ALLOWED = ["nickname", "recovery_reason", "daily_checkin_time", "porn_free_goal", "answers", "dependency_level"] as const;

export const onboardingSchema: Schema<OnboardingInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) {
    return object;
  }

  const value = object.value;
  const issues: ValidationIssue[] = [];
  rejectUnknownFields(value, ONBOARDING_ALLOWED, issues);

  const nickname = parseRequiredText(value.nickname, "nickname", 255, 1, issues);
  const recoveryReason = parseRequiredText(value.recovery_reason, "recovery_reason", 2000, 3, issues);
  const dailyCheckinTime = parseRequiredTime(value.daily_checkin_time, issues);
  const pornFreeGoal = parseRequiredInt(value.porn_free_goal, "porn_free_goal", 1, 3650, issues);

  let answers: Record<string, unknown> | undefined;
  if (value.answers !== undefined) {
    if (typeof value.answers === "object" && value.answers !== null && !Array.isArray(value.answers)) {
      answers = value.answers as Record<string, unknown>;
    } else if (value.answers === null) {
      answers = {};
    } else {
      issues.push({ field: "answers", message: "Must be an object or null." });
    }
  }

  let dependencyLevel: string | null | undefined;
  if (value.dependency_level !== undefined) {
    if (typeof value.dependency_level === "string" && value.dependency_level.trim().length > 0) {
      dependencyLevel = value.dependency_level.trim();
    } else if (value.dependency_level === null) {
      dependencyLevel = null;
    } else {
      issues.push({ field: "dependency_level", message: "Must be a string or null." });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues } as const;
  }

  return {
    ok: true,
    value: {
      nickname,
      recovery_reason: recoveryReason,
      daily_checkin_time: dailyCheckinTime,
      porn_free_goal: pornFreeGoal,
      answers,
      dependency_level: dependencyLevel,
    },
  } as const;
};
