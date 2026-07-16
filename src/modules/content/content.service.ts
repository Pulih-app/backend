import { AppError, AppErrorCode } from "../../shared/errors";
import type { CommunityCommentInput, CommunityPostInput, CommunityReplyInput, JournalInput } from "./content.schema";
import type { ContentRepository, DailyChallengePayload } from "./content.repository";

export type ContentService = ReturnType<typeof createContentService>;

const FALLBACK_MOTIVATION = "Keep going, no matter how small your step.";
const FALLBACK_CHALLENGE_TITLE = "Daily Reflection";
const FALLBACK_CHALLENGE_DESCRIPTION = "Write down one thing you are grateful for today.";
const FALLBACK_PHYSICAL_TITLE = "Light Daily Movement";
const FALLBACK_PHYSICAL_DESCRIPTION = "Take a 10-minute walk to reset your focus.";

function dayStartUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function stableIndexForDate(date: Date, length: number): number {
  if (length <= 0) return 0;
  let serial = Math.floor(date.getTime() / 86400000);
  if (serial < 0) serial = -serial;
  return serial % length;
}

export function createContentService(repository: ContentRepository) {
  return {
    createJournal(userId: string, input: JournalInput) { return repository.createJournal({ userId, content: input.content }); },
    listJournals(userId: string) { return repository.listJournals(userId); },

    listCommunityPosts(category?: string) { return repository.listPosts(category ? { category } : undefined); },
    createCommunityPost(userId: string, input: CommunityPostInput) {
      return repository.createPost({ userId, title: input.title, category: input.category, content: input.content });
    },

    createCommunityComment(userId: string, postId: string, input: CommunityCommentInput) {
      return repository.createComment({ userId, postId, content: input.content });
    },
    listCommunityComments(postId: string) { return repository.listComments(postId); },
    listCommunityThread(postId: string, rootLimit?: number) { return repository.listCommentThread(postId, rootLimit); },

    async createCommunityReply(userId: string, postId: string, parentCommentId: string, input: CommunityReplyInput) {
      const parent = (await repository.listComments(postId)).find((c) => c.id === parentCommentId);
      if (!parent) throw new AppError(AppErrorCode.NotFound, "Parent comment not found.", [`comment_id: Parent comment ${parentCommentId} not found.`]);
      if (parent.postId !== postId) throw new AppError(AppErrorCode.ValidationError, "Parent comment does not belong to this post.", ["comment_id: Parent comment must belong to the same post."]);
      const nextDepth = parent.depth + 1;
      if (nextDepth > 2) throw new AppError(AppErrorCode.ValidationError, "Maximum thread depth exceeded.", ["comment_id: Maximum reply depth is 2."]);
      return repository.createReply({ userId, postId, parentCommentId, content: input.content });
    },

    toggleCommunityLike(userId: string, postId: string) { return repository.toggleLike(postId, userId); },

    async listEducation(userId: string) {
      const user = await repository.findUserById(userId);
      if (!user) throw new AppError(AppErrorCode.NotFound, "User not found.", ["user_id: User not found."]);
      return repository.listEducation();
    },

    async getDailyContent(userId: string) {
      const user = await repository.findUserById(userId);
      if (!user) throw new AppError(AppErrorCode.NotFound, "User not found.", ["user_id: User not found."]);

      const [motivations, challenges, physicalChallenges] = await Promise.all([
        repository.listActiveMotivations(),
        repository.listActiveChallenges(),
        repository.listActivePhysicalChallenges(),
      ]);

      const today = dayStartUTC(new Date());
      const dateKey = today.toISOString().slice(0, 10);

      let motivation = FALLBACK_MOTIVATION;
      if (motivations.length > 0) {
        const idx = stableIndexForDate(today, motivations.length);
        const candidate = motivations[idx].content.trim();
        if (candidate !== "") motivation = candidate;
      }

      let challenge: DailyChallengePayload = { title: FALLBACK_CHALLENGE_TITLE, description: FALLBACK_CHALLENGE_DESCRIPTION };
      if (challenges.length > 0) {
        const idx = stableIndexForDate(today, challenges.length);
        const selected = challenges[idx];
        const title = selected.title.trim() || FALLBACK_CHALLENGE_TITLE;
        let description = selected.description.trim();
        if (!description) description = selected.content.trim();
        if (!description) description = FALLBACK_CHALLENGE_DESCRIPTION;
        challenge = { title, description };
      }

      let physicalChallenge: DailyChallengePayload = { title: FALLBACK_PHYSICAL_TITLE, description: FALLBACK_PHYSICAL_DESCRIPTION };
      if (physicalChallenges.length > 0) {
        const idx = stableIndexForDate(today, physicalChallenges.length);
        const selected = physicalChallenges[idx];
        const title = selected.title.trim() || FALLBACK_PHYSICAL_TITLE;
        const description = selected.description.trim() || FALLBACK_PHYSICAL_DESCRIPTION;
        physicalChallenge = { title, description };
      }

      return { date: dateKey, motivation, challenge, physicalChallenge };
    },

    listAchievementCatalog() { return repository.listAchievementCatalog(); },
    listAchievementProgress(userId: string) { return repository.listAchievementProgress(userId); },
    async listUnlockedAchievements(userId: string) { return (await repository.listAchievementProgress(userId)).filter((item) => item.unlockedAt !== null); },
  };
}
