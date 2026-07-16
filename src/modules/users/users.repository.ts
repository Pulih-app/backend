import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { profiles, users } from "../../db/schema";

export type UserProfileRecord = {
  id: string | null;
  userId: string;
  email: string;
  role: string;
  status: string;
  username: string | null;
  nickname: string | null;
  recoveryReason: string | null;
  dailyCheckinTime: string | null;
  pornFreeGoal: number | null;
  answers: Record<string, unknown>;
  dependencyLevel: string | null;
  aiSummary: string | null;
  onboardingCompletedAt: Date | null;
};

export type UserSettingsUpdate = {
  nickname?: string | null;
  recovery_reason?: string | null;
  daily_checkin_time?: string | null;
  porn_free_goal?: number | null;
};

export type OnboardingUpdate = UserSettingsUpdate & {
  answers?: Record<string, unknown>;
  dependency_level?: string | null;
  ai_summary?: string | null;
};

export type UsersRepository = {
  findCurrentUser(userId: string): Promise<UserProfileRecord | null>;
  updateSettings(userId: string, input: UserSettingsUpdate): Promise<UserProfileRecord>;
  completeOnboarding(userId: string, input: OnboardingUpdate): Promise<UserProfileRecord>;
};

type UserProfileRow = {
  userId: string;
  profileId: string | null;
  email: string;
  username: string | null;
  role: string;
  status: string;
  nickname: string | null;
  recoveryReason: string | null;
  dailyCheckinTime: string | null;
  pornFreeGoal: number | null;
  answers: unknown;
  dependencyLevel: string | null;
  aiSummary: string | null;
  onboardingCompletedAt: Date | null;
};

function mapRow(row: UserProfileRow): UserProfileRecord {
  return {
    id: row.profileId,
    userId: row.userId,
    email: row.email,
    role: row.role,
    status: row.status,
    username: row.username,
    nickname: row.nickname,
    recoveryReason: row.recoveryReason,
    dailyCheckinTime: row.dailyCheckinTime ? row.dailyCheckinTime.toString() : null,
    pornFreeGoal: row.pornFreeGoal,
    answers: (row.answers ?? {}) as Record<string, unknown>,
    dependencyLevel: row.dependencyLevel,
    aiSummary: row.aiSummary,
    onboardingCompletedAt: row.onboardingCompletedAt,
  };
}

export function createUsersRepository(db: NodePgDatabase): UsersRepository {
  return {
    async findCurrentUser(userId) {
      const [row] = await db.select({
        userId: users.id,
        profileId: profiles.id,
        email: users.email,
        username: users.username,
        role: users.role,
        status: users.status,
        nickname: profiles.nickname,
        recoveryReason: profiles.recoveryReason,
        dailyCheckinTime: profiles.dailyCheckinTime,
        pornFreeGoal: users.pornFreeGoal,
        answers: profiles.answers,
        dependencyLevel: profiles.dependencyLevel,
        aiSummary: profiles.aiSummary,
        onboardingCompletedAt: profiles.onboardingCompletedAt,
      }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, userId)).limit(1);

      return row ? mapRow(row) : null;
    },
    async updateSettings(userId, input) {
      const userChanges: Record<string, unknown> = {};
      if (input.porn_free_goal !== undefined) { userChanges.pornFreeGoal = input.porn_free_goal; }

      const profileChanges: Record<string, unknown> = {};
      if (input.nickname !== undefined) { profileChanges.nickname = input.nickname; }
      if (input.recovery_reason !== undefined) { profileChanges.recoveryReason = input.recovery_reason; }
      if (input.daily_checkin_time !== undefined) { profileChanges.dailyCheckinTime = input.daily_checkin_time; }

      if (Object.keys(userChanges).length > 0) {
        await db.update(users).set(userChanges).where(eq(users.id, userId));
      }

      if (Object.keys(profileChanges).length > 0) {
        await db.insert(profiles).values({
          userId,
          ...profileChanges,
        }).onConflictDoUpdate({
          target: profiles.userId,
          set: {
            ...profileChanges,
            updatedAt: new Date(),
          },
        });
      }

      const profile = await this.findCurrentUser(userId);
      if (!profile) {
        throw new Error("Updated user profile was not found.");
      }
      return profile;
    },
    async completeOnboarding(userId, input) {
      const userChanges: Record<string, unknown> = {};
      if (input.porn_free_goal !== undefined) { userChanges.pornFreeGoal = input.porn_free_goal; }

      const profileChanges: Record<string, unknown> = {
        onboardingCompletedAt: new Date(),
      };
      if (input.nickname !== undefined) { profileChanges.nickname = input.nickname; }
      if (input.recovery_reason !== undefined) { profileChanges.recoveryReason = input.recovery_reason; }
      if (input.daily_checkin_time !== undefined) { profileChanges.dailyCheckinTime = input.daily_checkin_time; }
      if (input.answers !== undefined) { profileChanges.answers = input.answers; }
      if (input.dependency_level !== undefined) { profileChanges.dependencyLevel = input.dependency_level; }
      if (input.ai_summary !== undefined) { profileChanges.aiSummary = input.ai_summary; }

      if (Object.keys(userChanges).length > 0) {
        await db.update(users).set(userChanges).where(eq(users.id, userId));
      }

      await db.insert(profiles).values({
        userId,
        ...profileChanges,
      }).onConflictDoUpdate({
        target: profiles.userId,
        set: {
          ...profileChanges,
          updatedAt: new Date(),
        },
      });

      const profile = await this.findCurrentUser(userId);
      if (!profile) {
        throw new Error("Updated user profile was not found.");
      }
      return profile;
    },
  };
}
