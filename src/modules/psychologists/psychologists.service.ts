import { AppError, AppErrorCode } from "../../shared/errors";
import type { CredentialStorage } from "./credential-storage";
import type { CredentialDocumentType } from "./psychologists.types";
import { REQUIRED_DOCUMENTS_BY_TYPE, channelForType } from "./psychologists.types";
import type { PsychologistProfileInput } from "./psychologists.schema";
import type { PsychologistsRepository } from "./psychologists.repository";

const ALLOWED_CONTENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateCredentialFile(file: File) {
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["file: Credential file must be PDF, JPG, JPEG, or PNG."]);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["file: Credential file must be at most 5 MB."]);
  }
}

export function createPsychologistsService(repository: PsychologistsRepository, storage?: CredentialStorage) {
  return {
    async upsertProfile(userId: string, input: PsychologistProfileInput) {
      const activePlaces = (input.practicePlaces ?? []).filter((place) => place.isActive !== false);
      if (input.type === "clinical" && activePlaces.length > 3) {
        throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["practicePlaces: Clinical psychologists can submit at most 3 active practice places."]);
      }
      if (input.type === "general" && activePlaces.length > 0) {
        throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["practicePlaces: Practice places are only accepted for clinical psychologists."]);
      }

      return repository.upsertProfile({
        userId,
        type: input.type,
        consultationChannel: channelForType(input.type),
        fullName: input.fullName,
        licenseNumber: input.licenseNumber ?? null,
        bio: input.bio ?? null,
        practicePlaces: input.practicePlaces ?? [],
      });
    },
    async getProfile(userId: string) {
      return repository.findByUserId(userId);
    },
    async uploadCredentialFile(userId: string, documentType: CredentialDocumentType, file: File) {
      const profile = await repository.findByUserId(userId);
      if (!profile) throw new AppError(AppErrorCode.Conflict, "Psychologist profile must be completed before uploading credentials.");
      if (!REQUIRED_DOCUMENTS_BY_TYPE[profile.type].includes(documentType)) {
        throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["documentType: Document type is not allowed for this psychologist type."]);
      }
      validateCredentialFile(file);
      if (!storage) throw new AppError(AppErrorCode.ServiceUnavailable, "Credential storage is not configured.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `psychologist-credentials/${profile.id}/${documentType}/${crypto.randomUUID()}-${safeName}`;
      await storage.put({ key: objectKey, file, metadata: { profileId: profile.id, documentType } });
      return repository.createCredentialFile({
        profileId: profile.id,
        documentType,
        objectKey,
        fileName: safeName,
        contentType: file.type,
        sizeBytes: file.size,
      });
    },
    async submitForReview(userId: string) {
      const profile = await repository.findByUserId(userId);
      if (!profile) throw new AppError(AppErrorCode.Conflict, "Psychologist profile must be completed before review submission.");
      if (!profile.fullName) throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["fullName: Full name is required."]);
      if (profile.type === "clinical" && profile.practicePlaces.filter((place) => place.isActive).length > 3) {
        throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["practicePlaces: Clinical psychologists can have at most 3 active practice places."]);
      }
      const files = await repository.listCredentialFiles(profile.id);
      const provided = new Set(files.map((file) => file.documentType));
      const missing = REQUIRED_DOCUMENTS_BY_TYPE[profile.type].filter((documentType) => !provided.has(documentType));
      if (missing.length > 0) {
        throw new AppError(AppErrorCode.Conflict, "Required credential files are missing.", missing.map((documentType) => `credentialFiles: ${documentType} is required.`));
      }
      await repository.updateApprovalStatus(profile.id, "pending_review");
      return { ...profile, approvalStatus: "pending_review" as const };
    },
    async getCredentialReviewFallback(userId: string, fileId: string) {
      const file = await repository.findCredentialFileByOwner(userId, fileId);
      if (!file) throw new AppError(AppErrorCode.NotFound, "Credential file was not found.");
      return {
        fileId: file.id,
        reviewUrl: null,
        expiresAt: null,
        message: "Signed review URL is not configured. Use Cloudflare R2 dashboard/manual operations for private review.",
      };
    },
  };
}

export type PsychologistsService = ReturnType<typeof createPsychologistsService>;
