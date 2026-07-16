import { AppError, AppErrorCode } from "../../shared/errors";
import type { CommunityCommentInput, CommunityPostInput, CommunityReplyInput, JournalInput } from "./content.schema";
import type { ContentRepository } from "./content.repository";

export type ContentService = ReturnType<typeof createContentService>;

function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
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

    listEducation() { return repository.listEducation(); },
    getDailyContent(localDate = jakartaDate()) { return repository.getDailyContent(localDate); },
    listAchievementCatalog() { return repository.listAchievementCatalog(); },
    listAchievementProgress(userId: string) { return repository.listAchievementProgress(userId); },
    async listUnlockedAchievements(userId: string) { return (await repository.listAchievementProgress(userId)).filter((item) => item.unlockedAt !== null); },
  };
}
