import { AppError, AppErrorCode } from "../../shared/errors";
import type { CredentialStorage } from "./credential-storage";
import type { CredentialDocumentType } from "./psychologists.types";
import { buildPackageName, channelForType, REQUIRED_DOCUMENTS_BY_TYPE, type GeneratedSessionStatus } from "./psychologists.types";
import type { PsychologistProfileInput, SessionBundleInput } from "./psychologists.schema";
import type { PsychologistsRepository, PsychologistSessionRecord } from "./psychologists.repository";

const ALLOWED_CONTENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const FILE_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_PRICE = 100000;
const MAX_PRICE = 300000;

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["date: Must use YYYY-MM-DD format."]);
  }
  return date;
}

function combineDateAndTime(date: string, time: string) {
  const result = new Date(`${date}T${time}.000Z`);
  if (Number.isNaN(result.getTime())) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["dateTime: Must use valid date and time values."]);
  }
  return result;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTimeString(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function durationMinutes(start: string, end: string) {
  const [startHours, startMinutes, startSeconds] = start.split(":").map(Number);
  const [endHours, endMinutes, endSeconds] = end.split(":").map(Number);
  return ((endHours * 60 + endMinutes + endSeconds / 60) - (startHours * 60 + startMinutes + startSeconds / 60));
}

function buildSessions(input: SessionBundleInput): Array<{ sessionDate: string; startsAt: string; endsAt: string; status: GeneratedSessionStatus; heldUntil: string | null }> {
  const startDate = parseDateOnly(input.dateStart);
  const endDate = parseDateOnly(input.dateEnd);
  const sessions = [];
  for (let current = new Date(startDate); current <= endDate; current = addDays(current, 1)) {
    const date = toDateString(current);
    const startsAt = combineDateAndTime(date, toTimeString(input.dailyStartTime));
    const endsAt = combineDateAndTime(date, toTimeString(input.dailyEndTime));
    sessions.push({
      sessionDate: date,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "available" as const,
      heldUntil: null,
    });
  }
  return sessions;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime();
}

function validateBundleInput(input: SessionBundleInput) {
  const price = Math.round(input.priceAmount);
  if (price < MIN_PRICE || price > MAX_PRICE) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["priceAmount: Must be between 100000 and 300000."]);
  }

  const minutes = durationMinutes(input.dailyStartTime, input.dailyEndTime);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["dailyStartTime: Daily end time must be after daily start time."]);
  }

  return { priceAmount: price, packageDurationMinutes: Math.round(minutes) };
}

async function ensureNoOverlap(repository: PsychologistsRepository, profileId: string, bundleId: string | null, generatedSessions: ReturnType<typeof buildSessions>) {
  const existingSessions = await repository.listSessionsByPsychologistId(profileId);
  const activeSessions = existingSessions.filter((session) => !bundleId || session.bundleId !== bundleId).filter((session) => session.status !== "cancelled" && session.status !== "expired" && session.status !== "rescheduled");

  for (const generated of generatedSessions) {
    for (const existing of activeSessions) {
      if (overlaps(generated.startsAt, generated.endsAt, existing.startsAt, existing.endsAt)) {
        throw new AppError(AppErrorCode.Conflict, "Generated session overlaps with an existing active session.");
      }
    }
  }
}

async function ensureBundleHasNoLockedSessions(repository: PsychologistsRepository, bundleId: string) {
  const sessions = await repository.listSessionsByBundleIds([bundleId]);
  const locked = sessions.find((session) => !["available", "cancelled", "expired"].includes(session.status));
  if (locked) {
    throw new AppError(AppErrorCode.Conflict, "Session bundle has booked or held sessions and cannot be changed.");
  }
}

function hasExpectedMagicBytes(contentType: string, bytes: Uint8Array) {
  if (contentType === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  }
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  return false;
}

export async function validateCredentialFile(file: File) {
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["file: Credential file must be PDF, JPG, JPEG, or PNG."]);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["file: Credential file must be at most 5 MB."]);
  }
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!hasExpectedMagicBytes(file.type, bytes)) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["file: Credential file content does not match the declared file type."]);
  }
}

export function createPsychologistsService(repository: PsychologistsRepository, storage?: CredentialStorage) {
  return {
    async upsertProfile(userId: string, input: PsychologistProfileInput) {
      return repository.upsertProfile({
        userId,
        type: input.type,
        consultationChannel: channelForType(input.type),
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth,
        address: input.address,
        photoUrl: input.photoUrl,
        bio: input.bio ?? null,
      });
    },
    async getProfile(userId: string) {
      return repository.findByUserId(userId);
    },
    async getPublicDirectory() {
      return repository.listApproved();
    },
    async getPublicProfile(psychologistId: string) {
      const profile = await repository.findApprovedById(psychologistId);
      if (!profile) throw new AppError(AppErrorCode.NotFound, "Psychologist profile was not found.");
      return profile;
    },
    async listPublicSessions(psychologistId: string) {
      const profile = await repository.findApprovedById(psychologistId);
      if (!profile) throw new AppError(AppErrorCode.NotFound, "Psychologist profile was not found.");
      const sessions = await repository.listSessionsByPsychologistId(profile.id);
      return sessions.filter((session) => session.status === "available");
    },
    async listAllPublicSessions() {
      return repository.listApprovedAvailableSessions();
    },
    async uploadCredentialFile(userId: string, documentType: CredentialDocumentType, file: File) {
      const profile = await repository.findByUserId(userId);
      if (!profile) throw new AppError(AppErrorCode.Conflict, "Psychologist profile must be completed before uploading credentials.");
      if (!REQUIRED_DOCUMENTS_BY_TYPE[profile.type].includes(documentType)) {
        throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["documentType: Document type is not allowed for this psychologist type."]);
      }
      await validateCredentialFile(file);
      if (!storage) throw new AppError(AppErrorCode.ServiceUnavailable, "Credential storage is not configured.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255) || `${documentType}.${FILE_EXTENSION_BY_CONTENT_TYPE[file.type]}`;
      const extension = FILE_EXTENSION_BY_CONTENT_TYPE[file.type];
      const objectKey = `psychologist-credentials/${profile.id}/${documentType}/${crypto.randomUUID()}.${extension}`;
      await storage.put({ key: objectKey, file, metadata: { profileId: profile.id, documentType } });
      const record = await repository.createCredentialFile({
        profileId: profile.id,
        documentType,
        objectKey,
        fileName: safeName,
        contentType: file.type,
        sizeBytes: file.size,
      });
      const { objectKey: _objectKey, ...publicRecord } = record;
      return publicRecord;
    },
    async submitForReview(userId: string) {
      const profile = await repository.findByUserId(userId);
      if (!profile) throw new AppError(AppErrorCode.Conflict, "Psychologist profile must be completed before review submission.");
      if (!profile.fullName) throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["fullName: Full name is required."]);
      const files = await repository.listCredentialFiles(profile.id);
      const provided = new Set(files.map((file) => file.documentType));
      const missing = REQUIRED_DOCUMENTS_BY_TYPE[profile.type].filter((documentType) => !provided.has(documentType));
      if (missing.length > 0) {
        throw new AppError(AppErrorCode.Conflict, "Required credential files are missing.", missing.map((documentType) => `credentialFiles: ${documentType} is required.`));
      }
      await repository.updateApprovalStatus(profile.id, "pending_review");
      return { ...profile, approvalStatus: "pending_review" as const };
    },
    async getCredentialReviewUrl(userId: string, fileId: string) {
      const file = await repository.findCredentialFileByOwner(userId, fileId);
      if (!file) throw new AppError(AppErrorCode.NotFound, "Credential file was not found.");
      if (!storage) {
        return {
          fileId: file.id,
          reviewUrl: null,
          expiresAt: null,
          message: "Credential storage is not configured.",
        };
      }
      const expiresInSeconds = 3600;
      const reviewUrl = await storage.getSignedUrl(file.objectKey, expiresInSeconds);
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      return { fileId: file.id, reviewUrl, expiresAt };
    },
    async createBundle(userId: string, input: SessionBundleInput) {
      const profile = await repository.findByUserId(userId);
      if (!profile) throw new AppError(AppErrorCode.NotFound, "Psychologist profile was not found.");
      if (profile.approvalStatus !== "approved") throw new AppError(AppErrorCode.Forbidden, "Only approved psychologists can create session bundles.");

      const validated = validateBundleInput(input);
      const packageName = buildPackageName(validated.packageDurationMinutes);
      const generatedSessions = buildSessions(input);
      await ensureNoOverlap(repository, profile.id, null, generatedSessions);
      const bundle = await repository.createBundleWithSessions({
        profileId: profile.id,
        packageName,
        packageDurationMinutes: validated.packageDurationMinutes,
        priceAmount: validated.priceAmount,
        dateStart: input.dateStart,
        dateEnd: input.dateEnd,
        dailyStartTime: input.dailyStartTime,
        dailyEndTime: input.dailyEndTime,
        sessions: generatedSessions,
      });
      return { bundle, sessions: generatedSessions };
    },
    async updateBundle(userId: string, bundleId: string, input: SessionBundleInput) {
      const profile = await repository.findByUserId(userId);
      if (!profile) throw new AppError(AppErrorCode.NotFound, "Psychologist profile was not found.");
      const bundle = await repository.findBundleById(bundleId);
      if (!bundle) throw new AppError(AppErrorCode.NotFound, "Session bundle was not found.");
      if (bundle.profileId !== profile.id) throw new AppError(AppErrorCode.Forbidden, "You can only manage your own session bundles.");
      if (profile.approvalStatus !== "approved") throw new AppError(AppErrorCode.Forbidden, "Only approved psychologists can manage session bundles.");
      await ensureBundleHasNoLockedSessions(repository, bundleId);

      const validated = validateBundleInput(input);
      const packageName = buildPackageName(validated.packageDurationMinutes);
      const generatedSessions = buildSessions(input);
      await ensureNoOverlap(repository, profile.id, bundleId, generatedSessions);
      const updated = await repository.updateBundleWithSessions(bundleId, {
        packageName,
        packageDurationMinutes: validated.packageDurationMinutes,
        priceAmount: validated.priceAmount,
        dateStart: input.dateStart,
        dateEnd: input.dateEnd,
        dailyStartTime: input.dailyStartTime,
        dailyEndTime: input.dailyEndTime,
        sessions: generatedSessions,
      });
      if (!updated) throw new AppError(AppErrorCode.NotFound, "Session bundle was not found.");
      return { bundle: updated, sessions: generatedSessions };
    },
    async deleteBundle(userId: string, bundleId: string) {
      const profile = await repository.findByUserId(userId);
      if (!profile) throw new AppError(AppErrorCode.NotFound, "Psychologist profile was not found.");
      const bundle = await repository.findBundleById(bundleId);
      if (!bundle) throw new AppError(AppErrorCode.NotFound, "Session bundle was not found.");
      if (bundle.profileId !== profile.id) throw new AppError(AppErrorCode.Forbidden, "You can only manage your own session bundles.");
      if (profile.approvalStatus !== "approved") throw new AppError(AppErrorCode.Forbidden, "Only approved psychologists can manage session bundles.");
      await ensureBundleHasNoLockedSessions(repository, bundleId);
      await repository.deleteSessionsByBundleId(bundleId);
      await repository.deleteBundle(bundleId);
      return { deleted: true };
    },
  };
}

export type PsychologistsService = ReturnType<typeof createPsychologistsService>;
