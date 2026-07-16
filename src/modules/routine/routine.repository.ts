import { count, desc, eq, gte, lte, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { checkIns, relapses, streaks, users } from "../../db/schema";

export type CheckInRecord = {
  id: string;
  userId: string;
  mood: string;
  isSuccessful: boolean;
  commitment: string | null;
  localDate: string;
  createdAt: string;
};

export type RelapseRecord = {
  id: string;
  userId: string;
  mood: string;
  triggers: string[];
  commitment: string | null;
  checkInId: string | null;
  localDate: string;
  createdAt: string;
};

export type StreakRecord = {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastCheckInLocalDate: string | null;
  lastRelapseLocalDate: string | null;
  updatedAt: string;
};

export type RoutineRepository = {
  transaction<T>(callback: (repository: RoutineRepository) => Promise<T>): Promise<T>;
  findCheckInByUserAndDate(userId: string, localDate: string): Promise<CheckInRecord | null>;
  createCheckIn(input: { userId: string; mood: string; isSuccessful: boolean; commitment: string | null; localDate: string }): Promise<CheckInRecord>;
  findRelapseByUserAndDate(userId: string, localDate: string): Promise<RelapseRecord | null>;
  createRelapse(input: { userId: string; mood: string; triggers: string[]; commitment: string | null; checkInId: string | null; localDate: string }): Promise<RelapseRecord>;
  findStreakByUserId(userId: string): Promise<StreakRecord | null>;
  upsertStreak(input: { userId: string; currentStreak: number; longestStreak: number; lastCheckInLocalDate: string | null; lastRelapseLocalDate: string | null }): Promise<void>;
  listCheckInsByUser(userId: string): Promise<CheckInRecord[]>;
  listCheckInsByUserWithinDateRange(userId: string, startDate: string, endDate: string): Promise<CheckInRecord[]>;
  listRelapses(userId: string): Promise<RelapseRecord[]>;
  listRelapsesByUserWithinDateRange(userId: string, startDate: string, endDate: string): Promise<RelapseRecord[]>;
  getCheckInCount(userId: string): Promise<number>;
  getRelapseCount(userId: string): Promise<number>;
  findUserById(userId: string): Promise<{ id: string; pornFreeGoal: number | null } | null>;
};

function mapCheckIn(row: typeof checkIns.$inferSelect): CheckInRecord {
  return {
    id: row.id,
    userId: row.userId,
    mood: row.mood,
    isSuccessful: row.isSuccessful,
    commitment: row.commitment,
    localDate: row.localDate,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRelapse(row: typeof relapses.$inferSelect): RelapseRecord {
  return {
    id: row.id,
    userId: row.userId,
    mood: row.mood,
    triggers: row.triggers,
    commitment: row.commitment,
    checkInId: row.checkInId,
    localDate: row.localDate,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapStreak(row: typeof streaks.$inferSelect): StreakRecord {
  return {
    userId: row.userId,
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
    lastCheckInLocalDate: row.lastCheckInLocalDate,
    lastRelapseLocalDate: row.lastRelapseLocalDate,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function createRepository(source: NodePgDatabase): RoutineRepository {
  return {
    async transaction<T>(callback: (repository: RoutineRepository) => Promise<T>) {
      return source.transaction(async (tx) => callback(createRepository(tx as NodePgDatabase)));
    },

    async findCheckInByUserAndDate(userId, localDate) {
      const [row] = await source.select().from(checkIns).where(
        and(eq(checkIns.userId, userId), eq(checkIns.localDate, localDate)),
      ).limit(1);
      return row ? mapCheckIn(row) : null;
    },

    async createCheckIn(input) {
      const [row] = await source.insert(checkIns).values(input).returning();
      return mapCheckIn(row);
    },

    async findRelapseByUserAndDate(userId, localDate) {
      const [row] = await source.select().from(relapses).where(
        and(eq(relapses.userId, userId), eq(relapses.localDate, localDate)),
      ).limit(1);
      return row ? mapRelapse(row) : null;
    },

    async createRelapse(input) {
      const [row] = await source.insert(relapses).values(input).returning();
      return mapRelapse(row);
    },

    async findStreakByUserId(userId) {
      const [row] = await source.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);
      return row ? mapStreak(row) : null;
    },

    async upsertStreak(input) {
      await source.insert(streaks).values(input).onConflictDoUpdate({
        target: streaks.userId,
        set: {
          currentStreak: input.currentStreak,
          longestStreak: input.longestStreak,
          lastCheckInLocalDate: input.lastCheckInLocalDate,
          lastRelapseLocalDate: input.lastRelapseLocalDate,
          updatedAt: new Date(),
        },
      });
    },

    async listCheckInsByUser(userId) {
      const rows = await source.select().from(checkIns).where(eq(checkIns.userId, userId)).orderBy(desc(checkIns.createdAt));
      return rows.map(mapCheckIn);
    },

    async listCheckInsByUserWithinDateRange(userId, startDate, endDate) {
      const rows = await source.select().from(checkIns).where(
        and(eq(checkIns.userId, userId), gte(checkIns.localDate, startDate), lte(checkIns.localDate, endDate)),
      ).orderBy(desc(checkIns.createdAt));
      return rows.map(mapCheckIn);
    },

    async listRelapses(userId) {
      const rows = await source.select().from(relapses).where(eq(relapses.userId, userId)).orderBy(desc(relapses.createdAt));
      return rows.map(mapRelapse);
    },

    async listRelapsesByUserWithinDateRange(userId, startDate, endDate) {
      const rows = await source.select().from(relapses).where(
        and(eq(relapses.userId, userId), gte(relapses.localDate, startDate), lte(relapses.localDate, endDate)),
      ).orderBy(desc(relapses.createdAt));
      return rows.map(mapRelapse);
    },

    async getCheckInCount(userId) {
      const [row] = await source.select({ value: count() }).from(checkIns).where(eq(checkIns.userId, userId));
      return row?.value ?? 0;
    },

    async getRelapseCount(userId) {
      const [row] = await source.select({ value: count() }).from(relapses).where(eq(relapses.userId, userId));
      return row?.value ?? 0;
    },

    async findUserById(userId) {
      const [row] = await source.select({ id: users.id, pornFreeGoal: users.pornFreeGoal }).from(users).where(eq(users.id, userId)).limit(1);
      return row ?? null;
    },
  };
}

export function createRoutineRepository(db: NodePgDatabase): RoutineRepository {
  return createRepository(db);
}
