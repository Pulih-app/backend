import type { Schema, ValidationIssue } from "../../shared/http/validation";
import { CREDENTIAL_DOCUMENT_TYPES, PSYCHOLOGIST_TYPES, REQUIRED_DOCUMENTS_BY_TYPE, type CredentialDocumentType, type PsychologistType } from "./psychologists.types";

export type PsychologistProfileInput = {
  type: PsychologistType;
  fullName: string;
  dateOfBirth: string;
  address: string;
  photoUrl: string;
  bio?: string | null;
};
export type CredentialFileParams = { fileId: string };
export type PsychologistPublicParams = { psychologistId: string };
export type PsychologistBundleParams = { bundleId: string };
export type SessionBundleInput = {
  dateStart: string;
  dateEnd: string;
  dailyStartTime: string;
  dailyEndTime: string;
  priceAmount: number;
};
export type AvailabilityWindowPackageInput = { durationMinutes: number; priceAmount: number };
export type AvailabilityWindowInput = {
  dateStart: string;
  dateEnd: string;
  dailyStartTime: string;
  dailyEndTime: string;
  packages: AvailabilityWindowPackageInput[];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function ensureObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }
  return { ok: true, value: input as Record<string, unknown> } as const;
}

function rejectUnknownFields(value: Record<string, unknown>, allowed: readonly string[], issues: ValidationIssue[]) {
  for (const field of Object.keys(value)) if (!allowed.includes(field)) issues.push({ field, message: "Unknown field is not allowed." });
}

function parseRequiredText(value: unknown, field: string, max: number, issues: ValidationIssue[]) {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ field, message: "Must be a non-empty string." });
    return "";
  }
  const normalized = value.trim();
  if (normalized.length > max) issues.push({ field, message: `Must be at most ${max} characters.` });
  return normalized;
}

function parseOptionalText(value: unknown, field: string, max: number, issues: ValidationIssue[]) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a string or null." });
    return undefined;
  }
  const normalized = value.trim();
  if (normalized.length > max) issues.push({ field, message: `Must be at most ${max} characters.` });
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalBoolean(value: unknown, field: string, issues: ValidationIssue[]) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    issues.push({ field, message: "Must be a boolean." });
    return undefined;
  }
  return value;
}

function parseDate(value: unknown, field: string, issues: ValidationIssue[]) {
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a date string." });
    return "";
  }
  const normalized = value.trim();
  if (!DATE_PATTERN.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    issues.push({ field, message: "Must use YYYY-MM-DD format." });
  }
  return normalized;
}

function parseTime(value: unknown, field: string, issues: ValidationIssue[]) {
  if (typeof value !== "string") {
    issues.push({ field, message: "Must be a time string." });
    return "";
  }
  const normalized = value.trim();
  if (!TIME_PATTERN.test(normalized)) {
    issues.push({ field, message: "Must use HH:mm format." });
    return "";
  }
  return normalized.length === 5 ? `${normalized}:00` : normalized;
}

function parseMoney(value: unknown, field: string, issues: ValidationIssue[]) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ field, message: "Must be a number." });
    return 0;
  }
  if (value < 100000 || value > 300000) {
    issues.push({ field, message: "Must be between 100000 and 300000." });
  }
  return value;
}

function parsePositiveInteger(value: unknown, field: string, issues: ValidationIssue[]) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push({ field, message: "Must be an integer." });
    return 0;
  }
  if (value <= 0) issues.push({ field, message: "Must be greater than 0." });
  return value;
}

function parseProfile(input: unknown) {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const value = object.value;
  const issues: ValidationIssue[] = [];
  rejectUnknownFields(value, ["type", "fullName", "dateOfBirth", "address", "photoUrl", "bio"], issues);

  const type = typeof value.type === "string" && PSYCHOLOGIST_TYPES.includes(value.type as PsychologistType) ? value.type as PsychologistType : undefined;
  if (!type) issues.push({ field: "type", message: "Must be one of general, clinical." });

  const parsed: PsychologistProfileInput = {
    type: type ?? "general",
    fullName: parseRequiredText(value.fullName, "fullName", 255, issues),
    dateOfBirth: parseDate(value.dateOfBirth, "dateOfBirth", issues),
    address: parseRequiredText(value.address, "address", 1000, issues),
    photoUrl: parseRequiredText(value.photoUrl, "photoUrl", 500_000, issues),
    bio: parseOptionalText(value.bio, "bio", 2000, issues),
  };

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: parsed } as const;
}

function parseBundle(input: unknown) {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const value = object.value;
  const issues: ValidationIssue[] = [];
  rejectUnknownFields(value, ["dateStart", "dateEnd", "dailyStartTime", "dailyEndTime", "priceAmount"], issues);

  const parsed: SessionBundleInput = {
    dateStart: parseDate(value.dateStart, "dateStart", issues),
    dateEnd: parseDate(value.dateEnd, "dateEnd", issues),
    dailyStartTime: parseTime(value.dailyStartTime, "dailyStartTime", issues),
    dailyEndTime: parseTime(value.dailyEndTime, "dailyEndTime", issues),
    priceAmount: parseMoney(value.priceAmount, "priceAmount", issues),
  };

  if (parsed.dateStart && parsed.dateEnd && parsed.dateStart > parsed.dateEnd) {
    issues.push({ field: "dateStart", message: "Must be on or before dateEnd." });
  }
  if (parsed.dailyStartTime && parsed.dailyEndTime && parsed.dailyStartTime >= parsed.dailyEndTime) {
    issues.push({ field: "dailyStartTime", message: "Must be earlier than dailyEndTime." });
  }

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: parsed } as const;
}

function parseAvailabilityWindow(input: unknown) {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const value = object.value;
  const issues: ValidationIssue[] = [];
  rejectUnknownFields(value, ["dateStart", "dateEnd", "dailyStartTime", "dailyEndTime", "packages"], issues);

  const packages: AvailabilityWindowPackageInput[] = [];
  if (!Array.isArray(value.packages) || value.packages.length === 0) {
    issues.push({ field: "packages", message: "Must be a non-empty array." });
  } else {
    value.packages.forEach((item, index) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        issues.push({ field: `packages.${index}`, message: "Must be an object." });
        return;
      }
      const packageValue = item as Record<string, unknown>;
      rejectUnknownFields(packageValue, ["durationMinutes", "priceAmount"], issues);
      packages.push({
        durationMinutes: parsePositiveInteger(packageValue.durationMinutes, `packages.${index}.durationMinutes`, issues),
        priceAmount: parseMoney(packageValue.priceAmount, `packages.${index}.priceAmount`, issues),
      });
    });
  }

  const parsed: AvailabilityWindowInput = {
    dateStart: parseDate(value.dateStart, "dateStart", issues),
    dateEnd: parseDate(value.dateEnd, "dateEnd", issues),
    dailyStartTime: parseTime(value.dailyStartTime, "dailyStartTime", issues),
    dailyEndTime: parseTime(value.dailyEndTime, "dailyEndTime", issues),
    packages,
  };

  if (parsed.dateStart && parsed.dateEnd && parsed.dateStart > parsed.dateEnd) {
    issues.push({ field: "dateStart", message: "Must be on or before dateEnd." });
  }
  if (parsed.dailyStartTime && parsed.dailyEndTime && parsed.dailyStartTime >= parsed.dailyEndTime) {
    issues.push({ field: "dailyStartTime", message: "Must be earlier than dailyEndTime." });
  }

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: parsed } as const;
}

export const psychologistProfileSchema: Schema<PsychologistProfileInput> = parseProfile;
export const sessionBundleSchema: Schema<SessionBundleInput> = parseBundle;
export const availabilityWindowSchema: Schema<AvailabilityWindowInput> = parseAvailabilityWindow;
export const credentialFileParamsSchema: Schema<CredentialFileParams> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const fileId = object.value.fileId;
  if (typeof fileId !== "string" || !UUID_PATTERN.test(fileId)) return { ok: false, issues: [{ field: "fileId", message: "Must be a valid file id." }] };
  return { ok: true, value: { fileId } };
};

export const psychologistPublicParamsSchema: Schema<PsychologistPublicParams> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const psychologistId = object.value.psychologistId;
  if (typeof psychologistId !== "string" || !UUID_PATTERN.test(psychologistId)) return { ok: false, issues: [{ field: "psychologistId", message: "Must be a valid psychologist id." }] };
  return { ok: true, value: { psychologistId } };
};

export const psychologistBundleParamsSchema: Schema<PsychologistBundleParams> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const bundleId = object.value.bundleId;
  if (typeof bundleId !== "string" || !UUID_PATTERN.test(bundleId)) return { ok: false, issues: [{ field: "bundleId", message: "Must be a valid bundle id." }] };
  return { ok: true, value: { bundleId } };
};

export function validateDocumentType(type: PsychologistType, value: unknown): CredentialDocumentType | ValidationIssue {
  if (typeof value !== "string" || !CREDENTIAL_DOCUMENT_TYPES.includes(value as CredentialDocumentType)) return { field: "documentType", message: "Must be a supported credential document type." };
  const documentType = value as CredentialDocumentType;
  if (!REQUIRED_DOCUMENTS_BY_TYPE[type].includes(documentType)) return { field: "documentType", message: "Document type is not allowed for this psychologist type." };
  return documentType;
}
