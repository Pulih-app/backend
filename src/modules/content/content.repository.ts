import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { achievements, checkIns, communityComments, communityPostLikes, communityPosts, dailyChallenges, dailyMotivations, dailyPhysicalChallenges, educationContents, journals, streaks, userAchievementProgress, users } from "../../db/schema";

export type JournalRecord = { id: string; userId: string; content: string; createdAt: string; updatedAt: string };
export type CommunityPostAuthor = { nickname: string; currentStreak: number };
export type CommunityPostRecord = { id: string; userId: string; title: string | null; category: string; content: string; likeCount: number; commentCount: number; createdAt: string; updatedAt: string; author: CommunityPostAuthor };
export type CommunityCommentRecord = { id: string; postId: string; userId: string; parentCommentId: string | null; content: string; depth: number; replyCount: number; createdAt: string };
export type CommunityCommentNode = CommunityCommentRecord & { replies: CommunityCommentNode[] };
export type CommunityThreadRecord = { postId: string; comments: CommunityCommentNode[] };
export type EducationRecord = { id: string; title: string; description: string | null; url: string; thumbnailUrl: string | null; category: string; type: string; publishedAt: string | null };
export type DailyChallengePayload = { title: string; description: string };
export type DailyContentRecord = { date: string; motivation: string; challenge: DailyChallengePayload; physicalChallenge: DailyChallengePayload };
export type AchievementRecord = { id: string; key: string; title: string; description: string; criteria: unknown; createdAt: string };
export type AchievementProgressRecord = { achievement: AchievementRecord; progressValue: number; unlockedAt: string | null };

export type ContentRepository = {
  createJournal(input: { userId: string; content: string }): Promise<JournalRecord>;
  listJournals(userId: string): Promise<JournalRecord[]>;
  createPost(input: { userId: string; title?: string; category: "advice" | "motivation" | "story" | "question" | "help"; content: string }): Promise<CommunityPostRecord>;
  listPosts(filter?: { category?: string }): Promise<CommunityPostRecord[]>;
  createComment(input: { postId: string; userId: string; content: string }): Promise<CommunityCommentRecord>;
  listComments(postId: string): Promise<CommunityCommentRecord[]>;
  listCommentThread(postId: string, rootLimit?: number): Promise<CommunityThreadRecord>;
  createReply(input: { postId: string; userId: string; parentCommentId: string; content: string }): Promise<CommunityCommentRecord>;
  toggleLike(postId: string, userId: string): Promise<{ likedCount: number; isLiked: boolean }>;
  listEducation(): Promise<EducationRecord[]>;
  getDailyContent(): Promise<DailyContentRecord>;
  findUserById(userId: string): Promise<{ id: string } | null>;
  listActiveMotivations(): Promise<{ id: string; content: string; isActive: boolean; createdAt: Date }[]>;
  listActiveChallenges(): Promise<{ id: string; title: string; description: string; content: string; isActive: boolean; createdAt: Date }[]>;
  listActivePhysicalChallenges(): Promise<{ id: string; title: string; description: string; isActive: boolean; createdAt: Date }[]>;
  listAchievementCatalog(): Promise<AchievementRecord[]>;
  listAchievementProgress(userId: string): Promise<AchievementProgressRecord[]>;
};

const iso = (date: Date | null) => date ? date.toISOString() : null;
const mapJournal = (row: typeof journals.$inferSelect): JournalRecord => ({ id: row.id, userId: row.userId, content: row.content, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

type PostListRow = { id: string; userId: string; title: string | null; category: string; content: string; likeCount: number; commentCount: number; createdAt: Date; updatedAt: Date; authorNickname: string | null; currentStreak: number | null };
const mapPost = (row: PostListRow): CommunityPostRecord => ({
  id: row.id, userId: row.userId, title: row.title, category: row.category, content: row.content,
  likeCount: row.likeCount, commentCount: row.commentCount,
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  author: { nickname: row.authorNickname ?? "Anonymous", currentStreak: row.currentStreak ?? 0 },
});

const mapComment = (row: typeof communityComments.$inferSelect): CommunityCommentRecord => ({
  id: row.id, postId: row.postId, userId: row.userId, parentCommentId: row.parentCommentId ?? null,
  content: row.content, depth: row.depth, replyCount: row.replyCount, createdAt: row.createdAt.toISOString(),
});

const mapAchievement = (row: typeof achievements.$inferSelect): AchievementRecord => ({ id: row.id, key: row.key, title: row.title, description: row.description, criteria: row.criteria, createdAt: row.createdAt.toISOString() });

const MAX_THREAD_DEPTH = 2;

export function createContentRepository(db: NodePgDatabase): ContentRepository {
  return {
    async createJournal(input) { const [row] = await db.insert(journals).values(input).returning(); return mapJournal(row); },
    async listJournals(userId) { return (await db.select().from(journals).where(eq(journals.userId, userId)).orderBy(desc(journals.createdAt))).map(mapJournal); },

    async createPost(input) {
      const [row] = await db.insert(communityPosts).values({
        userId: input.userId,
        title: input.title ?? null,
        category: input.category,
        content: input.content,
      }).returning();
      const [userRow] = await db.select({ username: users.username }).from(users).where(eq(users.id, input.userId)).limit(1) as unknown as { username: string | null }[];
      const authorNickname = userRow?.username ?? "Anonymous";
      return { id: row.id, userId: row.userId, title: row.title, category: row.category, content: row.content, likeCount: row.likeCount, commentCount: row.commentCount, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), author: { nickname: authorNickname, currentStreak: 0 } };
    },

    async listPosts(filter) {
      const query = (db as any)
        .select({
          id: communityPosts.id, userId: communityPosts.userId, title: communityPosts.title,
          category: communityPosts.category, content: communityPosts.content,
          likeCount: communityPosts.likeCount, commentCount: communityPosts.commentCount,
          createdAt: communityPosts.createdAt, updatedAt: communityPosts.updatedAt,
          authorNickname: users.username,
          currentStreak: streaks.currentStreak,
        })
        .from(communityPosts)
        .innerJoin(users, eq(users.id, communityPosts.userId))
        .leftJoin(streaks, eq(streaks.userId, communityPosts.userId))
        .orderBy(desc(communityPosts.createdAt));

      if (filter?.category) {
        query.where(eq(communityPosts.category, filter.category as any));
      }

      const rows = await query as unknown as PostListRow[];
      return rows.map(mapPost);
    },

    async createComment(input) {
      return await db.transaction(async (tx) => {
        const [row] = await tx.insert(communityComments).values({
          postId: input.postId, userId: input.userId, content: input.content, depth: 0, replyCount: 0,
        }).returning();
        await tx.update(communityPosts).set({ commentCount: sql`${communityPosts.commentCount} + 1`, updatedAt: new Date() }).where(eq(communityPosts.id, input.postId));
        return mapComment(row);
      });
    },

    async listComments(postId) {
      return (await db.select().from(communityComments).where(eq(communityComments.postId, postId)).orderBy(desc(communityComments.createdAt))).map(mapComment);
    },

    async listCommentThread(postId, rootLimit = 200) {
      // Recursive CTE for threaded comments
      const rows = await db.execute(sql`
        WITH RECURSIVE root_comments AS (
          SELECT id
          FROM community_comments
          WHERE post_id = ${postId}::uuid AND parent_comment_id IS NULL
          ORDER BY created_at ASC, id ASC
          LIMIT ${rootLimit}
        ),
        thread AS (
          SELECT
            c.id, c.post_id, c.user_id, c.parent_comment_id,
            c.content, c.depth, c.reply_count, c.created_at
          FROM community_comments c
          JOIN root_comments rc ON rc.id = c.id
          UNION ALL
          SELECT
            child.id, child.post_id, child.user_id, child.parent_comment_id,
            child.content, child.depth, child.reply_count, child.created_at
          FROM community_comments child
          JOIN thread parent ON child.parent_comment_id = parent.id
        )
        SELECT
          id, post_id, user_id, parent_comment_id,
          content, depth, reply_count, created_at
        FROM thread
        ORDER BY created_at ASC, id ASC
      `);

      const flatRows = (rows as unknown as any[]).map((r: any) => ({
        id: r.id as string,
        postId: r.post_id as string,
        userId: r.user_id as string,
        parentCommentId: (r.parent_comment_id as string) ?? null,
        content: r.content as string,
        depth: Number(r.depth),
        replyCount: Number(r.reply_count),
        createdAt: (r.created_at as Date).toISOString(),
      })) as CommunityCommentRecord[];

      return { postId, comments: buildCommentTree(flatRows) };
    },

    async createReply(input) {
      const MAX_DEPTH = 2;
      return await db.transaction(async (tx) => {
        const [parent] = await tx.select().from(communityComments).where(eq(communityComments.id, input.parentCommentId));
        if (!parent) throw new Error("Parent comment not found");
        if (parent.postId !== input.postId) throw new Error("Parent comment does not belong to this post");

        const depth = parent.depth + 1;
        if (depth > MAX_DEPTH) throw new Error(`Maximum thread depth of ${MAX_DEPTH} exceeded`);

        const [row] = await tx.insert(communityComments).values({
          postId: input.postId, userId: input.userId, parentCommentId: input.parentCommentId,
          content: input.content, depth, replyCount: 0,
        }).returning();

        await tx.update(communityComments).set({ replyCount: sql`${communityComments.replyCount} + 1` }).where(eq(communityComments.id, input.parentCommentId));
        await tx.update(communityPosts).set({ commentCount: sql`${communityPosts.commentCount} + 1`, updatedAt: new Date() }).where(eq(communityPosts.id, input.postId));

        return mapComment(row);
      });
    },

    async toggleLike(postId, userId) {
      return await db.transaction(async (tx) => {
        // Check if like exists
        const [existing] = await tx.select().from(communityPostLikes).where(and(eq(communityPostLikes.postId, postId), eq(communityPostLikes.userId, userId)));

        if (existing) {
          // Unlike
          await tx.delete(communityPostLikes).where(and(eq(communityPostLikes.postId, postId), eq(communityPostLikes.userId, userId)));
          await tx.update(communityPosts).set({ likeCount: sql`GREATEST(${communityPosts.likeCount} - 1, 0)`, updatedAt: new Date() }).where(eq(communityPosts.id, postId));
          const [post] = await tx.select({ likeCount: communityPosts.likeCount }).from(communityPosts).where(eq(communityPosts.id, postId));
          return { likedCount: post?.likeCount ?? 0, isLiked: false };
        }

        // Like
        await tx.insert(communityPostLikes).values({ postId, userId }).onConflictDoNothing();
        await tx.update(communityPosts).set({ likeCount: sql`${communityPosts.likeCount} + 1`, updatedAt: new Date() }).where(eq(communityPosts.id, postId));
        const [post] = await tx.select({ likeCount: communityPosts.likeCount }).from(communityPosts).where(eq(communityPosts.id, postId));
        return { likedCount: post?.likeCount ?? 0, isLiked: true };
      });
    },

    async findUserById(userId: string) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      return row ?? null;
    },
    async listEducation() {
      const rows = await db.select().from(educationContents).where(eq(educationContents.isActive, true)).orderBy(asc(educationContents.title));
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        url: row.url,
        thumbnailUrl: row.thumbnailUrl ?? null,
        category: row.category.replace(/_/g, " "),
        type: row.type === "video" ? "video" : "artikel",
        publishedAt: iso(row.publishedAt),
      }));
    },
    async listActiveMotivations() {
      return await db.select().from(dailyMotivations).where(eq(dailyMotivations.isActive, true)).orderBy(asc(dailyMotivations.createdAt), asc(dailyMotivations.id));
    },
    async listActiveChallenges() {
      return await db.select().from(dailyChallenges).where(eq(dailyChallenges.isActive, true)).orderBy(asc(dailyChallenges.createdAt), asc(dailyChallenges.id));
    },
    async listActivePhysicalChallenges() {
      return await db.select().from(dailyPhysicalChallenges).where(eq(dailyPhysicalChallenges.isActive, true)).orderBy(asc(dailyPhysicalChallenges.createdAt), asc(dailyPhysicalChallenges.id));
    },
    async getDailyContent() {
      return { date: "", motivation: "", challenge: { title: "", description: "" }, physicalChallenge: { title: "", description: "" } };
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

function buildCommentTree(flatRows: CommunityCommentRecord[]): CommunityCommentNode[] {
  const byId = new Map<string, CommunityCommentNode>();
  const roots: CommunityCommentNode[] = [];

  for (const row of flatRows) {
    byId.set(row.id, { ...row, replies: [] });
  }

  for (const row of flatRows) {
    const node = byId.get(row.id)!;
    if (row.parentCommentId && byId.has(row.parentCommentId)) {
      byId.get(row.parentCommentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
