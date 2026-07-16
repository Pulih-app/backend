import type { Schema, ValidationIssue } from "../../shared/http/validation";
import { CREDENTIAL_DOCUMENT_TYPES, PSYCHOLOGIST_TYPES, REQUIRED_DOCUMENTS_BY_TYPE, type CredentialDocumentType, type PsychologistType } from "./psychologists.types";

export type PracticePlaceInput = { name: string; address: string; isActive?: boolean };
export type PsychologistProfileInput = {
  type: PsychologistType;
  fullName: string;
  licenseNumber?: string | null;
  bio?: string | null;
  practicePlaces?: PracticePlaceInput[];
};
export type CredentialFileParams = { fileId: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function parsePracticePlaces(value: unknown, type: PsychologistType, issues: ValidationIssue[]) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    issues.push({ field: "practicePlaces", message: "Must be an array." });
    return [];
  }
  if (type === "general" && value.length > 0) issues.push({ field: "practicePlaces", message: "Practice places are only accepted for clinical psychologists." });
  if (type === "clinical" && value.length > 3) issues.push({ field: "practicePlaces", message: "Clinical psychologists can submit at most 3 active practice places." });

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      issues.push({ field: `practicePlaces.${index}`, message: "Must be an object." });
      return { name: "", address: "", isActive: true };
    }
    const object = item as Record<string, unknown>;
    rejectUnknownFields(object, ["name", "address", "isActive"], issues);
    if (object.isActive !== undefined && typeof object.isActive !== "boolean") issues.push({ field: `practicePlaces.${index}.isActive`, message: "Must be a boolean." });
    return {
      name: parseRequiredText(object.name, `practicePlaces.${index}.name`, 255, issues),
      address: parseRequiredText(object.address, `practicePlaces.${index}.address`, 1000, issues),
      isActive: object.isActive === undefined ? true : object.isActive as boolean,
    };
  });
}

function parseProfile(input: unknown) {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const value = object.value;
  const issues: ValidationIssue[] = [];
  rejectUnknownFields(value, ["type", "fullName", "licenseNumber", "bio", "practicePlaces"], issues);

  const type = typeof value.type === "string" && PSYCHOLOGIST_TYPES.includes(value.type as PsychologistType) ? value.type as PsychologistType : undefined;
  if (!type) issues.push({ field: "type", message: "Must be one of general, clinical." });

  const parsed: PsychologistProfileInput = {
    type: type ?? "general",
    fullName: parseRequiredText(value.fullName, "fullName", 255, issues),
    licenseNumber: parseOptionalText(value.licenseNumber, "licenseNumber", 128, issues),
    bio: parseOptionalText(value.bio, "bio", 2000, issues),
    practicePlaces: parsePracticePlaces(value.practicePlaces, type ?? "general", issues),
  };

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: parsed } as const;
}

export const psychologistProfileSchema: Schema<PsychologistProfileInput> = parseProfile;
export const credentialFileParamsSchema: Schema<CredentialFileParams> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;
  const fileId = object.value.fileId;
  if (typeof fileId !== "string" || !UUID_PATTERN.test(fileId)) return { ok: false, issues: [{ field: "fileId", message: "Must be a valid file id." }] };
  return { ok: true, value: { fileId } };
};

export function validateDocumentType(type: PsychologistType, value: unknown): CredentialDocumentType | ValidationIssue {
  if (typeof value !== "string" || !CREDENTIAL_DOCUMENT_TYPES.includes(value as CredentialDocumentType)) return { field: "documentType", message: "Must be a supported credential document type." };
  const documentType = value as CredentialDocumentType;
  if (!REQUIRED_DOCUMENTS_BY_TYPE[type].includes(documentType)) return { field: "documentType", message: "Document type is not allowed for this psychologist type." };
  return documentType;
}
