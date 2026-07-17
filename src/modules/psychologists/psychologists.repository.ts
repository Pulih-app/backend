import { and, asc, avg, count, desc, eq, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  psychologistCredentialFiles,
  psychologistProfiles,
  psychologistSessionBundles,
  psychologistSessionSlots,
  bookingReviews,
  users,
} from "../../db/schema";
import type {
  ApprovalStatus,
  ConsultationChannel,
  CredentialDocumentType,
  GeneratedSessionStatus,
  PsychologistType,
} from "./psychologists.types";
export type CredentialFileRecord = { id: string; profileId: string; documentType: CredentialDocumentType; objectKey: string; fileName: string; contentType: string; sizeBytes: number };
export type PsychologistBundleRecord = {
  id: string;
  profileId: string;
  packageName: string;
  packageDurationMinutes: number;
  priceAmount: number;
  dateStart: string;
  dateEnd: string;
  dailyStartTime: string;
  dailyEndTime: string;
};
export type PsychologistSessionRecord = {
  id: string;
  bundleId: string;
  profileId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: GeneratedSessionStatus;
  heldUntil: string | null;
  packageName: string;
  packageDurationMinutes: number;
  priceAmount: number;
};
export type PsychologistRatingSummary = { averageRating: number; reviewCount: number };
export type PublicPsychologistReviewRecord = { id: string; bookingId: string; patientUserId: string; psychologistProfileId: string; rating: number; comment: string | null; createdAt: string; updatedAt: string };
export type PsychologistAvailabilityTimeRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: GeneratedSessionStatus;
  packageName: string;
  packageDurationMinutes: number;
  priceAmount: number;
};

export type PsychologistAvailabilityDateRecord = {
  date: string;
  totalSlots: number;
  availableSlots: number;
  heldSlots: number;
  bookedSlots: number;
  completedSlots: number;
  cancelledSlots: number;
  expiredSlots: number;
  rescheduledSlots: number;
  slots: PsychologistAvailabilityTimeRecord[];
};

export type PsychologistDirectoryRecord = {
  id: string;
  userId: string;
  type: PsychologistType;
  consultationChannel: ConsultationChannel;
  approvalStatus: ApprovalStatus;
  fullName: string;
  dateOfBirth: string | null;
  address: string | null;
  photoUrl: string | null;
  bio: string | null;
  ratingSummary: PsychologistRatingSummary;
  latestReviews: PublicPsychologistReviewRecord[];
  latestBundle: PsychologistBundleRecord | null;
};

export type PsychologistProfileRecord = PsychologistDirectoryRecord;
export type PsychologistProfileDetailRecord = PsychologistProfileRecord & { availability: PsychologistAvailabilityDateRecord[] };

export type PublicPsychologistSessionRecord = PsychologistSessionRecord & {
  psychologist: Pick<PsychologistDirectoryRecord, "id" | "userId" | "type" | "consultationChannel" | "fullName" | "dateOfBirth" | "address" | "photoUrl" | "bio" | "ratingSummary" | "latestReviews">;
};

export type PsychologistsRepository = {
  upsertProfile(input: Omit<PsychologistProfileRecord, "id" | "approvalStatus" | "ratingSummary" | "latestReviews" | "latestBundle">): Promise<PsychologistProfileRecord>;
  findByUserId(userId: string): Promise<PsychologistProfileRecord | null>;
  findApprovedById(psychologistId: string): Promise<PsychologistProfileRecord | null>;
  listApproved(): Promise<PsychologistProfileRecord[]>;
  createCredentialFile(input: Omit<CredentialFileRecord, "id">): Promise<CredentialFileRecord>;
  listCredentialFiles(profileId: string): Promise<CredentialFileRecord[]>;
  findCredentialFileByOwner(userId: string, fileId: string): Promise<CredentialFileRecord | null>;
  updateApprovalStatus(profileId: string, status: ApprovalStatus): Promise<void>;
  listBundles(profileId: string): Promise<PsychologistBundleRecord[]>;
  findBundleById(bundleId: string): Promise<PsychologistBundleRecord | null>;
  createBundleWithSessions(input: { profileId: string; packageName: string; packageDurationMinutes: number; priceAmount: number; dateStart: string; dateEnd: string; dailyStartTime: string; dailyEndTime: string; sessions: Array<{ sessionDate: string; startsAt: string; endsAt: string; status: GeneratedSessionStatus; heldUntil: string | null }> }): Promise<PsychologistBundleRecord>;
  updateBundleWithSessions(bundleId: string, input: { packageName: string; packageDurationMinutes: number; priceAmount: number; dateStart: string; dateEnd: string; dailyStartTime: string; dailyEndTime: string; sessions: Array<{ sessionDate: string; startsAt: string; endsAt: string; status: GeneratedSessionStatus; heldUntil: string | null }> }): Promise<PsychologistBundleRecord | null>;
  deleteBundle(bundleId: string): Promise<boolean>;
  deleteSessionsByBundleId(bundleId: string): Promise<void>;
  listSessionsByPsychologistId(psychologistId: string): Promise<PsychologistSessionRecord[]>;
  listApprovedAvailableSessions(): Promise<PublicPsychologistSessionRecord[]>;
  listSessionsByBundleIds(bundleIds: string[]): Promise<PsychologistSessionRecord[]>;
};

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toIsoTime(value: Date | string) {
  const raw = typeof value === "string" ? value : value.toISOString().slice(11, 19);
  return raw.length === 5 ? `${raw}:00` : raw;
}

function mapBundle(row: typeof psychologistSessionBundles.$inferSelect): PsychologistBundleRecord {
  return {
    id: row.id,
    profileId: row.profileId,
    packageName: row.packageName,
    packageDurationMinutes: row.packageDurationMinutes,
    priceAmount: toNumber(row.priceAmount),
    dateStart: toIsoDate(row.dateStart),
    dateEnd: toIsoDate(row.dateEnd),
    dailyStartTime: toIsoTime(row.dailyStartTime),
    dailyEndTime: toIsoTime(row.dailyEndTime),
  };
}

function mapSession(row: typeof psychologistSessionSlots.$inferSelect & { bundlePackageName: string; bundleDurationMinutes: number; bundlePriceAmount: number }): PsychologistSessionRecord {
  return {
    id: row.id,
    bundleId: row.bundleId,
    profileId: row.profileId,
    sessionDate: toIsoDate(row.sessionDate),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status as GeneratedSessionStatus,
    heldUntil: row.heldUntil ? row.heldUntil.toISOString() : null,
    packageName: row.bundlePackageName,
    packageDurationMinutes: row.bundleDurationMinutes,
    priceAmount: row.bundlePriceAmount,
  };
}

async function loadRatingSummary(db: NodePgDatabase, profileId: string): Promise<PsychologistRatingSummary> {
  const [summary] = await db.select({ averageRating: avg(bookingReviews.rating), reviewCount: count(bookingReviews.id) }).from(bookingReviews).where(eq(bookingReviews.psychologistProfileId, profileId));
  return {
    averageRating: summary?.averageRating ? Math.round(Number(summary.averageRating) * 10) / 10 : 0,
    reviewCount: Number(summary?.reviewCount ?? 0),
  };
}

function mapReview(row: typeof bookingReviews.$inferSelect): PublicPsychologistReviewRecord {
  return {
    id: row.id,
    bookingId: row.bookingId,
    patientUserId: row.patientUserId,
    psychologistProfileId: row.psychologistProfileId,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadLatestReviews(db: NodePgDatabase, profileId: string, limit = 5): Promise<PublicPsychologistReviewRecord[]> {
  const rows = await db.select().from(bookingReviews).where(eq(bookingReviews.psychologistProfileId, profileId)).orderBy(desc(bookingReviews.createdAt)).limit(limit);
  return rows.map(mapReview);
}

async function loadProfile(db: NodePgDatabase, userId: string): Promise<PsychologistProfileRecord | null> {
  const [profile] = await db.select().from(psychologistProfiles).where(eq(psychologistProfiles.userId, userId)).limit(1);
  if (!profile) return null;
  const bundles = await db.select().from(psychologistSessionBundles).where(eq(psychologistSessionBundles.profileId, profile.id)).orderBy(desc(psychologistSessionBundles.createdAt)).limit(1);
  const ratingSummary = await loadRatingSummary(db, profile.id);
  const latestReviews = await loadLatestReviews(db, profile.id);
  return {
    id: profile.id,
    userId: profile.userId,
    type: profile.type as PsychologistType,
    consultationChannel: profile.consultationChannel as ConsultationChannel,
    approvalStatus: profile.approvalStatus as ApprovalStatus,
    fullName: profile.fullName,
    dateOfBirth: profile.dateOfBirth,
    address: profile.address,
    photoUrl: profile.photoUrl,
    bio: profile.bio,
    ratingSummary,
    latestReviews,
    latestBundle: bundles[0] ? mapBundle(bundles[0]) : null,
  };
}

async function loadProfileById(db: NodePgDatabase, profileId: string): Promise<PsychologistProfileRecord | null> {
  const [row] = await db.select().from(psychologistProfiles).where(eq(psychologistProfiles.id, profileId)).limit(1);
  if (!row) return null;
  const bundles = await db.select().from(psychologistSessionBundles).where(eq(psychologistSessionBundles.profileId, row.id)).orderBy(desc(psychologistSessionBundles.createdAt)).limit(1);
  const ratingSummary = await loadRatingSummary(db, row.id);
  const latestReviews = await loadLatestReviews(db, row.id);
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as PsychologistType,
    consultationChannel: row.consultationChannel as ConsultationChannel,
    approvalStatus: row.approvalStatus as ApprovalStatus,
    fullName: row.fullName,
    dateOfBirth: row.dateOfBirth,
    address: row.address,
    photoUrl: row.photoUrl,
    bio: row.bio,
    ratingSummary,
    latestReviews,
    latestBundle: bundles[0] ? mapBundle(bundles[0]) : null,
  };
}

async function loadPublicProfiles(db: NodePgDatabase) {
  const rows = await db.select().from(psychologistProfiles).where(eq(psychologistProfiles.approvalStatus, "approved")).orderBy(desc(psychologistProfiles.createdAt));
  const result: PsychologistProfileRecord[] = [];
  for (const row of rows) {
    const profile = await loadProfileById(db, row.id);
    if (profile) result.push(profile);
  }
  return result;
}

async function loadBundle(db: NodePgDatabase, bundleId: string) {
  const [row] = await db.select().from(psychologistSessionBundles).where(eq(psychologistSessionBundles.id, bundleId)).limit(1);
  return row ? mapBundle(row) : null;
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
        dateOfBirth: input.dateOfBirth,
        address: input.address,
        photoUrl: input.photoUrl,
        bio: input.bio,
        approvalStatus: "approved",
      }).onConflictDoUpdate({
        target: psychologistProfiles.userId,
        set: {
          type: input.type,
          consultationChannel: input.consultationChannel,
          fullName: input.fullName,
          dateOfBirth: input.dateOfBirth,
          address: input.address,
          photoUrl: input.photoUrl,
          bio: input.bio,
          approvalStatus: "approved",
          updatedAt: new Date(),
        },
      }).returning();

      const reloaded = await loadProfile(db, input.userId);
      if (!reloaded) throw new Error("Updated psychologist profile was not found.");
      return reloaded;
    },
    findByUserId(userId) {
      return loadProfile(db, userId);
    },
    async findApprovedById(psychologistId) {
      const profile = await loadProfileById(db, psychologistId);
      if (!profile || profile.approvalStatus !== "approved") return null;
      return profile;
    },
    listApproved() {
      return loadPublicProfiles(db);
    },
    async createCredentialFile(input) {
      const [row] = await db.insert(psychologistCredentialFiles).values(input).returning();
      return {
        id: row.id,
        profileId: row.profileId,
        documentType: row.documentType as CredentialDocumentType,
        objectKey: row.objectKey,
        fileName: row.fileName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
      };
    },
    async listCredentialFiles(profileId) {
      const rows = await db.select().from(psychologistCredentialFiles).where(eq(psychologistCredentialFiles.profileId, profileId));
      return rows.map((row) => ({
        id: row.id,
        profileId: row.profileId,
        documentType: row.documentType as CredentialDocumentType,
        objectKey: row.objectKey,
        fileName: row.fileName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
      }));
    },
    async findCredentialFileByOwner(userId, fileId) {
      const [row] = await db.select({ file: psychologistCredentialFiles }).from(psychologistCredentialFiles)
        .innerJoin(psychologistProfiles, eq(psychologistCredentialFiles.profileId, psychologistProfiles.id))
        .where(and(eq(psychologistProfiles.userId, userId), eq(psychologistCredentialFiles.id, fileId))).limit(1);
      return row ? {
        id: row.file.id,
        profileId: row.file.profileId,
        documentType: row.file.documentType as CredentialDocumentType,
        objectKey: row.file.objectKey,
        fileName: row.file.fileName,
        contentType: row.file.contentType,
        sizeBytes: row.file.sizeBytes,
      } : null;
    },
    async updateApprovalStatus(profileId, status) {
      await db.update(psychologistProfiles).set({ approvalStatus: status, updatedAt: new Date() }).where(eq(psychologistProfiles.id, profileId));
    },
    async listBundles(profileId) {
      const rows = await db.select().from(psychologistSessionBundles).where(eq(psychologistSessionBundles.profileId, profileId)).orderBy(desc(psychologistSessionBundles.createdAt));
      return rows.map(mapBundle);
    },
    async findBundleById(bundleId) {
      return loadBundle(db, bundleId);
    },
    async createBundleWithSessions(input) {
      const [bundle] = await db.insert(psychologistSessionBundles).values({
        profileId: input.profileId,
        packageName: input.packageName,
        packageDurationMinutes: input.packageDurationMinutes,
        priceAmount: String(input.priceAmount),
        dateStart: new Date(`${input.dateStart}T00:00:00.000Z`),
        dateEnd: new Date(`${input.dateEnd}T00:00:00.000Z`),
        dailyStartTime: input.dailyStartTime,
        dailyEndTime: input.dailyEndTime,
      }).returning();

      if (input.sessions.length > 0) {
        await db.insert(psychologistSessionSlots).values(input.sessions.map((session) => ({
          bundleId: bundle.id,
          profileId: input.profileId,
          sessionDate: new Date(`${session.sessionDate}T00:00:00.000Z`),
          startsAt: new Date(session.startsAt),
          endsAt: new Date(session.endsAt),
          status: session.status,
          heldUntil: session.heldUntil ? new Date(session.heldUntil) : null,
        })));
      }

      return mapBundle(bundle);
    },
    async updateBundleWithSessions(bundleId, input) {
      const [updated] = await db.update(psychologistSessionBundles).set({
        packageName: input.packageName,
        packageDurationMinutes: input.packageDurationMinutes,
        priceAmount: String(input.priceAmount),
        dateStart: new Date(`${input.dateStart}T00:00:00.000Z`),
        dateEnd: new Date(`${input.dateEnd}T00:00:00.000Z`),
        dailyStartTime: input.dailyStartTime,
        dailyEndTime: input.dailyEndTime,
        updatedAt: new Date(),
      }).where(eq(psychologistSessionBundles.id, bundleId)).returning();

      await db.delete(psychologistSessionSlots).where(eq(psychologistSessionSlots.bundleId, bundleId));
      if (input.sessions.length > 0) {
        await db.insert(psychologistSessionSlots).values(input.sessions.map((session) => ({
          bundleId,
          profileId: updated.profileId,
          sessionDate: new Date(`${session.sessionDate}T00:00:00.000Z`),
          startsAt: new Date(session.startsAt),
          endsAt: new Date(session.endsAt),
          status: session.status,
          heldUntil: session.heldUntil ? new Date(session.heldUntil) : null,
        })));
      }

      return mapBundle(updated);
    },
    async deleteBundle(bundleId) {
      const result = await db.delete(psychologistSessionBundles).where(eq(psychologistSessionBundles.id, bundleId)).returning({ id: psychologistSessionBundles.id });
      return result.length > 0;
    },
    async deleteSessionsByBundleId(bundleId) {
      await db.delete(psychologistSessionSlots).where(eq(psychologistSessionSlots.bundleId, bundleId));
    },
    async listSessionsByPsychologistId(psychologistId) {
      const rows = await db.select({
        session: psychologistSessionSlots,
        bundlePackageName: psychologistSessionBundles.packageName,
        bundleDurationMinutes: psychologistSessionBundles.packageDurationMinutes,
        bundlePriceAmount: psychologistSessionBundles.priceAmount,
      }).from(psychologistSessionSlots)
        .innerJoin(psychologistSessionBundles, eq(psychologistSessionSlots.bundleId, psychologistSessionBundles.id))
        .where(eq(psychologistSessionSlots.profileId, psychologistId))
        .orderBy(asc(psychologistSessionSlots.sessionDate), asc(psychologistSessionSlots.startsAt));
      return rows.map(({ session, bundlePackageName, bundleDurationMinutes, bundlePriceAmount }) => mapSession({ ...session, bundlePackageName, bundleDurationMinutes, bundlePriceAmount: Number(bundlePriceAmount) }));
    },
    async listApprovedAvailableSessions() {
      const rows = await db.select({
        session: psychologistSessionSlots,
        bundlePackageName: psychologistSessionBundles.packageName,
        bundleDurationMinutes: psychologistSessionBundles.packageDurationMinutes,
        bundlePriceAmount: psychologistSessionBundles.priceAmount,
        profile: psychologistProfiles,
      }).from(psychologistSessionSlots)
        .innerJoin(psychologistSessionBundles, eq(psychologistSessionSlots.bundleId, psychologistSessionBundles.id))
        .innerJoin(psychologistProfiles, eq(psychologistSessionSlots.profileId, psychologistProfiles.id))
        .where(and(eq(psychologistProfiles.approvalStatus, "approved"), eq(psychologistSessionSlots.status, "available")))
        .orderBy(asc(psychologistSessionSlots.sessionDate), asc(psychologistSessionSlots.startsAt));

      const result: PublicPsychologistSessionRecord[] = [];
      for (const { session, bundlePackageName, bundleDurationMinutes, bundlePriceAmount, profile } of rows) {
        const publicProfile = await loadProfileById(db, profile.id);
        if (!publicProfile || publicProfile.approvalStatus !== "approved") continue;
        result.push({
          ...mapSession({ ...session, bundlePackageName, bundleDurationMinutes, bundlePriceAmount: Number(bundlePriceAmount) }),
          psychologist: {
            id: publicProfile.id,
            userId: publicProfile.userId,
            type: publicProfile.type,
            consultationChannel: publicProfile.consultationChannel,
            fullName: publicProfile.fullName,
            dateOfBirth: publicProfile.dateOfBirth,
            address: publicProfile.address,
            photoUrl: publicProfile.photoUrl,
            bio: publicProfile.bio,
            ratingSummary: publicProfile.ratingSummary,
            latestReviews: publicProfile.latestReviews,
          },
        });
      }
      return result;
    },
    async listSessionsByBundleIds(bundleIds) {
      if (bundleIds.length === 0) return [];
      const rows = await db.select({
        session: psychologistSessionSlots,
        bundlePackageName: psychologistSessionBundles.packageName,
        bundleDurationMinutes: psychologistSessionBundles.packageDurationMinutes,
        bundlePriceAmount: psychologistSessionBundles.priceAmount,
      }).from(psychologistSessionSlots)
        .innerJoin(psychologistSessionBundles, eq(psychologistSessionSlots.bundleId, psychologistSessionBundles.id))
        .where(or(...bundleIds.map((bundleId) => eq(psychologistSessionSlots.bundleId, bundleId))))
        .orderBy(asc(psychologistSessionSlots.sessionDate), asc(psychologistSessionSlots.startsAt));
      return rows.map(({ session, bundlePackageName, bundleDurationMinutes, bundlePriceAmount }) => mapSession({ ...session, bundlePackageName, bundleDurationMinutes, bundlePriceAmount: Number(bundlePriceAmount) }));
    },
  };
}
