import { count, desc, eq, gte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { checkIns, relapses, streaks } from "../../db/schema";

export type CheckInRecord = { id: string; userId: string; mood: number; note: string | null; localDate: string; createdAt: string };
export type RelapseRecord = { id: string; userId: string; mood: number; triggers: string[]; note: string | null; localDate: string; createdAt: string };
export type StreakRecord = { userId: string; currentStreak: number; longestStreak: number; lastCheckInLocalDate: string | null; lastRelapseLocalDate: string | null; updatedAt: string };

export type RoutineRepository = {
  transaction<T>(callback: (repository: RoutineRepository) => Promise<T>): Promise<T>;
  findCheckInByUserAndDate(userId: string, localDate: string): Promise<CheckInRecord | null>;
  createCheckIn(input: { userId: string; mood: number; note: string | null; localDate: string }): Promise<CheckInRecord>;
  createRelapse(input: { userId: string; mood: number; triggers: string[]; note: string | null; localDate: string }): Promise<RelapseRecord>;
  findStreakByUserId(userId: string): Promise<StreakRecord | null>;
  upsertStreak(input: { userId: string; currentStreak: number; longestStreak: number; lastCheckInLocalDate: string | null; lastRelapseLocalDate: string | null }): Promise<void>;
  getSummary(userId: string): Promise<{ checkInCount: number; relapseCount: number }>;
  getActivitySummary(userId: string, windowDays: number): Promise<{ windowDays: number; successfulCheckIns: number; relapses: number }>;
  listRelapses(userId: string): Promise<RelapseRecord[]>;
  getRelapseStatistics(userId: string): Promise<{ relapseCount: number; topTriggers: Array<{ trigger: string; count: number }> }>;
};

function mapCheckIn(row: typeof checkIns.$inferSelect): CheckInRecord {
  return { id: row.id, userId: row.userId, mood: row.mood, note: row.note, localDate: row.localDate, createdAt: row.createdAt.toISOString() };
}
function mapRelapse(row: typeof relapses.$inferSelect): RelapseRecord {
  return { id: row.id, userId: row.userId, mood: row.mood, triggers: row.triggers, note: row.note, localDate: row.localDate, createdAt: row.createdAt.toISOString() };
}
function mapStreak(row: typeof streaks.$inferSelect): StreakRecord {
  return { userId: row.userId, currentStreak: row.currentStreak, longestStreak: row.longestStreak, lastCheckInLocalDate: row.lastCheckInLocalDate, lastRelapseLocalDate: row.lastRelapseLocalDate, updatedAt: row.updatedAt.toISOString() };
}

function createRepository(source: NodePgDatabase): RoutineRepository {
  return {
    async transaction<T>(callback: (repository: RoutineRepository) => Promise<T>) { return source.transaction(async (tx) => callback(createRepository(tx as NodePgDatabase))); },
    async findCheckInByUserAndDate(userId, localDate) {
      const [row] = await source.select().from(checkIns).where(sql`${checkIns.userId} = ${userId} AND ${checkIns.localDate} = ${localDate}`).limit(1);
      return row ? mapCheckIn(row) : null;
    },
    async createCheckIn(input) {
      const [row] = await source.insert(checkIns).values(input).returning();
      return mapCheckIn(row);
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
      await source.insert(streaks).values(input).onConflictDoUpdate({ target: streaks.userId, set: { currentStreak: input.currentStreak, longestStreak: input.longestStreak, lastCheckInLocalDate: input.lastCheckInLocalDate, lastRelapseLocalDate: input.lastRelapseLocalDate, updatedAt: new Date() } });
    },
    async getSummary(userId) {
      const [checkInRow] = await source.select({ value: count() }).from(checkIns).where(eq(checkIns.userId, userId));
      const [relapseRow] = await source.select({ value: count() }).from(relapses).where(eq(relapses.userId, userId));
      return { checkInCount: checkInRow?.value ?? 0, relapseCount: relapseRow?.value ?? 0 };
    },
    async getActivitySummary(userId, windowDays) {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - windowDays + 1);
      const startDate = start.toISOString().slice(0, 10);
      const [checkInRow] = await source.select({ value: count() }).from(checkIns).where(sql`${checkIns.userId} = ${userId} AND ${checkIns.localDate} >= ${startDate}`);
      const [relapseRow] = await source.select({ value: count() }).from(relapses).where(sql`${relapses.userId} = ${userId} AND ${relapses.localDate} >= ${startDate}`);
      return { windowDays, successfulCheckIns: checkInRow?.value ?? 0, relapses: relapseRow?.value ?? 0 };
    },
    async listRelapses(userId) {
      const rows = await source.select().from(relapses).where(eq(relapses.userId, userId)).orderBy(desc(relapses.createdAt));
      return rows.map(mapRelapse);
    },
    async getRelapseStatistics(userId) {
      const items = await this.listRelapses(userId);
      const counts = new Map<string, number>();
      for (const relapse of items) for (const trigger of relapse.triggers) counts.set(trigger, (counts.get(trigger) ?? 0) + 1);
      return { relapseCount: items.length, topTriggers: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([trigger, count]) => ({ trigger, count })) };
    },
  };
}

export function createRoutineRepository(db: NodePgDatabase): RoutineRepository {
  return createRepository(db);
}
