import { and, count, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { achievements, checkIns, communityComments, communityPostLikes, communityPosts, dailyChallenges, dailyMotivations, educationContents, journals, streaks, userAchievementProgress } from "../../db/schema";

export type JournalRecord = { id: string; userId: string; content: string; createdAt: string; updatedAt: string };
export type CommunityPostRecord = { id: string; userId: string; category: string; content: string; likeCount: number; commentCount: number; createdAt: string; updatedAt: string };
export type CommunityCommentRecord = { id: string; postId: string; userId: string; content: string; createdAt: string };
export type EducationRecord = { id: string; title: string; content: string; category: string; publishedAt: string | null };
export type DailyContentRecord = { motivation: { id: string; content: string; source: string | null; localDate: string } | null; challenge: { id: string; title: string; description: string; category: string; localDate: string } | null };
export type AchievementRecord = { id: string; key: string; title: string; description: string; criteria: unknown; createdAt: string };
export type AchievementProgressRecord = { achievement: AchievementRecord; progressValue: number; unlockedAt: string | null };

export type ContentRepository = {
  createJournal(input: { userId: string; content: string }): Promise<JournalRecord>;
  listJournals(userId: string): Promise<JournalRecord[]>;
  createPost(input: { userId: string; category: "general" | "support" | "progress"; content: string }): Promise<CommunityPostRecord>;
  listPosts(): Promise<CommunityPostRecord[]>;
  createComment(input: { postId: string; userId: string; content: string }): Promise<CommunityCommentRecord>;
  listComments(postId: string): Promise<CommunityCommentRecord[]>;
  likePost(postId: string, userId: string): Promise<{ liked: true }>;
  listEducation(): Promise<EducationRecord[]>;
  getDailyContent(localDate: string): Promise<DailyContentRecord>;
  listAchievementCatalog(): Promise<AchievementRecord[]>;
  listAchievementProgress(userId: string): Promise<AchievementProgressRecord[]>;
};

const iso = (date: Date | null) => date ? date.toISOString() : null;
const mapJournal = (row: typeof journals.$inferSelect): JournalRecord => ({ id: row.id, userId: row.userId, content: row.content, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const mapPost = (row: typeof communityPosts.$inferSelect): CommunityPostRecord => ({ id: row.id, userId: row.userId, category: row.category, content: row.content, likeCount: row.likeCount, commentCount: row.commentCount, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const mapComment = (row: typeof communityComments.$inferSelect): CommunityCommentRecord => ({ id: row.id, postId: row.postId, userId: row.userId, content: row.content, createdAt: row.createdAt.toISOString() });
const mapAchievement = (row: typeof achievements.$inferSelect): AchievementRecord => ({ id: row.id, key: row.key, title: row.title, description: row.description, criteria: row.criteria, createdAt: row.createdAt.toISOString() });

export function createContentRepository(db: NodePgDatabase): ContentRepository {
  return {
    async createJournal(input) { const [row] = await db.insert(journals).values(input).returning(); return mapJournal(row); },
    async listJournals(userId) { return (await db.select().from(journals).where(eq(journals.userId, userId)).orderBy(desc(journals.createdAt))).map(mapJournal); },
    async createPost(input) { const [row] = await db.insert(communityPosts).values(input).returning(); return mapPost(row); },
    async listPosts() { return (await db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt))).map(mapPost); },
    async createComment(input) {
      return await db.transaction(async (tx) => {
        const [row] = await tx.insert(communityComments).values(input).returning();
        await tx.update(communityPosts).set({ commentCount: sql`${communityPosts.commentCount} + 1`, updatedAt: new Date() }).where(eq(communityPosts.id, input.postId));
        return mapComment(row);
      });
    },
    async listComments(postId) { return (await db.select().from(communityComments).where(eq(communityComments.postId, postId)).orderBy(desc(communityComments.createdAt))).map(mapComment); },
    async likePost(postId, userId) {
      return await db.transaction(async (tx) => {
        const inserted = await tx.insert(communityPostLikes).values({ postId, userId }).onConflictDoNothing().returning();
        if (inserted.length > 0) await tx.update(communityPosts).set({ likeCount: sql`${communityPosts.likeCount} + 1`, updatedAt: new Date() }).where(eq(communityPosts.id, postId));
        return { liked: true as const };
      });
    },
    async listEducation() {
      const rows = await db.select().from(educationContents).where(eq(educationContents.status, "published")).orderBy(desc(educationContents.publishedAt));
      return rows.map((row) => ({ id: row.id, title: row.title, content: row.content, category: row.category, publishedAt: iso(row.publishedAt) }));
    },
    async getDailyContent(localDate) {
      const [motivation] = await db.select().from(dailyMotivations).where(and(eq(dailyMotivations.localDate, localDate), eq(dailyMotivations.status, "published"))).limit(1);
      const [challenge] = await db.select().from(dailyChallenges).where(and(eq(dailyChallenges.localDate, localDate), eq(dailyChallenges.status, "published"))).limit(1);
      return {
        motivation: motivation ? { id: motivation.id, content: motivation.content, source: motivation.source, localDate: motivation.localDate } : null,
        challenge: challenge ? { id: challenge.id, title: challenge.title, description: challenge.description, category: challenge.category, localDate: challenge.localDate } : null,
      };
    },
    async listAchievementCatalog() { return (await db.select().from(achievements).orderBy(achievements.key)).map(mapAchievement); },
    async listAchievementProgress(userId) {
      const catalog = await this.listAchievementCatalog();
      const progressRows = await db.select().from(userAchievementProgress).where(eq(userAchievementProgress.userId, userId));
      const byAchievement = new Map(progressRows.map((row) => [row.achievementId, row]));
      const [journalRow] = await db.select({ value: count() }).from(journals).where(eq(journals.userId, userId));
      const [checkInRow] = await db.select({ value: count() }).from(checkIns).where(eq(checkIns.userId, userId));
      const [streakRow] = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);
      const activityValues = { journal_count: journalRow?.value ?? 0, check_in_count: checkInRow?.value ?? 0, streak: streakRow?.currentStreak ?? 0 };
      return catalog.map((achievement) => {
        const row = byAchievement.get(achievement.id);
        const criteria = achievement.criteria as { type?: keyof typeof activityValues; target?: number };
        const activityValue = criteria.type ? activityValues[criteria.type] ?? 0 : 0;
        const progressValue = Math.max(row?.progressValue ?? 0, activityValue);
        const unlockedAt = row?.unlockedAt ?? (typeof criteria.target === "number" && progressValue >= criteria.target ? new Date() : null);
        return { achievement, progressValue, unlockedAt: iso(unlockedAt) };
      });
    },
  };
}
