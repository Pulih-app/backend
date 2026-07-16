import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { profiles, users } from "../../db/schema";

export type UserProfileRecord = {
  id: string | null;
  userId: string;
  email: string;
  role: string;
  status: string;
  displayName: string | null;
  nickname: string | null;
  recoveryGoal: string | null;
  checkInTime: string | null;
  onboardingCompletedAt: Date | null;
};

export type UserSettingsUpdate = {
  displayName?: string | null;
  nickname?: string | null;
  recoveryGoal?: string | null;
  checkInTime?: string | null;
};

export type UsersRepository = {
  findCurrentUser(userId: string): Promise<UserProfileRecord | null>;
  updateSettings(userId: string, input: UserSettingsUpdate): Promise<UserProfileRecord>;
  completeOnboarding(userId: string, input: UserSettingsUpdate): Promise<UserProfileRecord>;
};

type UserProfileRow = {
  userId: string;
  profileId: string | null;
  email: string;
  role: string;
  status: string;
  displayName: string | null;
  nickname: string | null;
  recoveryGoal: string | null;
  checkInTime: string | null;
  onboardingCompletedAt: Date | null;
};

function mapRow(row: UserProfileRow): UserProfileRecord {
  return {
    id: row.profileId,
    userId: row.userId,
    email: row.email,
    role: row.role,
    status: row.status,
    displayName: row.displayName,
    nickname: row.nickname,
    recoveryGoal: row.recoveryGoal,
    checkInTime: row.checkInTime ? row.checkInTime.toString() : null,
    onboardingCompletedAt: row.onboardingCompletedAt,
  };
}

function buildProfileChanges(input: UserSettingsUpdate, onboardingCompletedAt?: Date | null) {
  return {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
    ...(input.recoveryGoal !== undefined ? { recoveryGoal: input.recoveryGoal } : {}),
    ...(input.checkInTime !== undefined ? { checkInTime: input.checkInTime } : {}),
    ...(onboardingCompletedAt !== undefined ? { onboardingCompletedAt } : {}),
  };
}

async function upsertProfile(db: NodePgDatabase, userId: string, input: UserSettingsUpdate, onboardingCompletedAt?: Date | null) {
  const changes = buildProfileChanges(input, onboardingCompletedAt);

  await db.insert(profiles).values({
    userId,
    ...changes,
  }).onConflictDoUpdate({
    target: profiles.userId,
    set: {
      ...changes,
      updatedAt: new Date(),
    },
  });
}

export function createUsersRepository(db: NodePgDatabase): UsersRepository {
  return {
    async findCurrentUser(userId) {
      const [row] = await db.select({
        userId: users.id,
        profileId: profiles.id,
        email: users.email,
        role: users.role,
        status: users.status,
        displayName: profiles.displayName,
        nickname: profiles.nickname,
        recoveryGoal: profiles.recoveryGoal,
        checkInTime: profiles.checkInTime,
        onboardingCompletedAt: profiles.onboardingCompletedAt,
      }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, userId)).limit(1);

      return row ? mapRow(row) : null;
    },
    async updateSettings(userId, input) {
      await upsertProfile(db, userId, input);
      const profile = await this.findCurrentUser(userId);
      if (!profile) {
        throw new Error("Updated user profile was not found.");
      }
      return profile;
    },
    async completeOnboarding(userId, input) {
      await upsertProfile(db, userId, input, new Date());
      const profile = await this.findCurrentUser(userId);
      if (!profile) {
        throw new Error("Updated user profile was not found.");
      }
      return profile;
    },
  };
}
