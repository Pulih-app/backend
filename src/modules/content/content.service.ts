import type { CommunityCommentInput, CommunityPostInput, JournalInput } from "./content.schema";
import type { ContentRepository } from "./content.repository";

export type ContentService = ReturnType<typeof createContentService>;

function jakartaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function createContentService(repository: ContentRepository) {
  return {
    createJournal(userId: string, input: JournalInput) { return repository.createJournal({ userId, content: input.content }); },
    listJournals(userId: string) { return repository.listJournals(userId); },
    listCommunityPosts() { return repository.listPosts(); },
    createCommunityPost(userId: string, input: CommunityPostInput) { return repository.createPost({ userId, category: input.category, content: input.content }); },
    createCommunityComment(userId: string, postId: string, input: CommunityCommentInput) { return repository.createComment({ userId, postId, content: input.content }); },
    listCommunityComments(postId: string) { return repository.listComments(postId); },
    likeCommunityPost(userId: string, postId: string) { return repository.likePost(postId, userId); },
    listEducation() { return repository.listEducation(); },
    getDailyContent(localDate = jakartaDate()) { return repository.getDailyContent(localDate); },
    listAchievementCatalog() { return repository.listAchievementCatalog(); },
    listAchievementProgress(userId: string) { return repository.listAchievementProgress(userId); },
    async listUnlockedAchievements(userId: string) { return (await repository.listAchievementProgress(userId)).filter((item) => item.unlockedAt !== null); },
  };
}
