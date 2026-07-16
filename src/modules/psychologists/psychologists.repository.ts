import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { psychologistCredentialFiles, psychologistPracticePlaces, psychologistProfiles, users } from "../../db/schema";
import type { ApprovalStatus, ConsultationChannel, CredentialDocumentType, PsychologistType } from "./psychologists.types";
import type { PracticePlaceInput } from "./psychologists.schema";

export type PsychologistProfileRecord = {
  id: string;
  userId: string;
  type: PsychologistType;
  consultationChannel: ConsultationChannel;
  approvalStatus: ApprovalStatus;
  fullName: string;
  licenseNumber: string | null;
  bio: string | null;
  practicePlaces: PracticePlaceRecord[];
};
export type PracticePlaceRecord = { id: string; name: string; address: string; isActive: boolean };
export type CredentialFileRecord = { id: string; profileId: string; documentType: CredentialDocumentType; objectKey: string; fileName: string; contentType: string; sizeBytes: number };

export type PsychologistsRepository = {
  upsertProfile(input: Omit<PsychologistProfileRecord, "id" | "practicePlaces" | "approvalStatus"> & { practicePlaces: PracticePlaceInput[] }): Promise<PsychologistProfileRecord>;
  findByUserId(userId: string): Promise<PsychologistProfileRecord | null>;
  createCredentialFile(input: Omit<CredentialFileRecord, "id">): Promise<CredentialFileRecord>;
  listCredentialFiles(profileId: string): Promise<CredentialFileRecord[]>;
  findCredentialFileByOwner(userId: string, fileId: string): Promise<CredentialFileRecord | null>;
  updateApprovalStatus(profileId: string, status: ApprovalStatus): Promise<void>;
};

function mapPracticePlace(row: typeof psychologistPracticePlaces.$inferSelect): PracticePlaceRecord {
  return { id: row.id, name: row.name, address: row.address, isActive: row.isActive };
}

async function loadProfile(db: NodePgDatabase, userId: string): Promise<PsychologistProfileRecord | null> {
  const [profile] = await db.select().from(psychologistProfiles).where(eq(psychologistProfiles.userId, userId)).limit(1);
  if (!profile) return null;
  const places = await db.select().from(psychologistPracticePlaces).where(eq(psychologistPracticePlaces.profileId, profile.id));
  return {
    id: profile.id,
    userId: profile.userId,
    type: profile.type as PsychologistType,
    consultationChannel: profile.consultationChannel as ConsultationChannel,
    approvalStatus: profile.approvalStatus as ApprovalStatus,
    fullName: profile.fullName,
    licenseNumber: profile.licenseNumber,
    bio: profile.bio,
    practicePlaces: places.map(mapPracticePlace),
  };
}

function mapCredential(row: typeof psychologistCredentialFiles.$inferSelect): CredentialFileRecord {
  return {
    id: row.id,
    profileId: row.profileId,
    documentType: row.documentType as CredentialDocumentType,
    objectKey: row.objectKey,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
  };
}

export function createPsychologistsRepository(db: NodePgDatabase): PsychologistsRepository {
  return {
    async upsertProfile(input) {
      await db.update(users).set({ role: "psychologist", updatedAt: new Date() }).where(eq(users.id, input.userId));
      const [profile] = await db.insert(psychologistProfiles).values({
        userId: input.userId,
        type: input.type,
        consultationChannel: input.consultationChannel,
        fullName: input.fullName,
        licenseNumber: input.licenseNumber,
        bio: input.bio,
      }).onConflictDoUpdate({
        target: psychologistProfiles.userId,
        set: {
          type: input.type,
          consultationChannel: input.consultationChannel,
          fullName: input.fullName,
          licenseNumber: input.licenseNumber,
          bio: input.bio,
          approvalStatus: "draft",
          updatedAt: new Date(),
        },
      }).returning();

      await db.delete(psychologistPracticePlaces).where(eq(psychologistPracticePlaces.profileId, profile.id));
      if (input.practicePlaces.length > 0) {
        await db.insert(psychologistPracticePlaces).values(input.practicePlaces.map((place) => ({
          profileId: profile.id,
          name: place.name,
          address: place.address,
          isActive: place.isActive ?? true,
        })));
      }

      const reloaded = await loadProfile(db, input.userId);
      if (!reloaded) throw new Error("Updated psychologist profile was not found.");
      return reloaded;
    },
    findByUserId(userId) {
      return loadProfile(db, userId);
    },
    async createCredentialFile(input) {
      const [row] = await db.insert(psychologistCredentialFiles).values(input).returning();
      return mapCredential(row);
    },
    async listCredentialFiles(profileId) {
      const rows = await db.select().from(psychologistCredentialFiles).where(eq(psychologistCredentialFiles.profileId, profileId));
      return rows.map(mapCredential);
    },
    async findCredentialFileByOwner(userId, fileId) {
      const [row] = await db.select({ file: psychologistCredentialFiles }).from(psychologistCredentialFiles)
        .innerJoin(psychologistProfiles, eq(psychologistCredentialFiles.profileId, psychologistProfiles.id))
        .where(and(eq(psychologistProfiles.userId, userId), eq(psychologistCredentialFiles.id, fileId))).limit(1);
      return row ? mapCredential(row.file) : null;
    },
    async updateApprovalStatus(profileId, status) {
      await db.update(psychologistProfiles).set({ approvalStatus: status, updatedAt: new Date() }).where(eq(psychologistProfiles.id, profileId));
    },
  };
}
