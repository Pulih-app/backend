import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import { issueAccessToken } from "../auth/token";
import type { ContentRepository, JournalRecord, CommunityPostRecord, CommunityCommentRecord, AchievementRecord, AchievementProgressRecord, EducationRecord, DailyContentRecord } from "./content.repository";

const TEST_ENV = {
  APP_NAME: "pulih-api", APP_ENV: "local", NODE_ENV: "test", API_PREFIX: "/api/v1", APP_URL: "http://localhost:3000", PWA_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable", DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  JWT_ACCESS_SECRET: "test-secret", JWT_ACCESS_TTL_SECONDS: "86400", PASSWORD_HASH_COST: "4", CORS_ALLOWED_ORIGINS: "http://localhost:3001", REQUEST_ID_HEADER: "x-request-id", PAKASIR_API_KEY: "test-pakasir-key",
};
const AUTH_USER = { id: "11111111-1111-4111-8111-111111111111", email: "patient@example.com", username: null, role: "patient" as const, status: "active" };
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function memoryRepository(): ContentRepository {
  const journals: JournalRecord[] = [];
  const posts: CommunityPostRecord[] = [];
  const comments: CommunityCommentRecord[] = [];
  const likes = new Set<string>();
  const education: EducationRecord[] = [{ id: "edu-1", title: "Safe Recovery", content: "Small safe steps.", category: "recovery", publishedAt: new Date().toISOString() }];
  const daily: DailyContentRecord = { motivation: { id: "mot-1", content: "Stay steady.", source: "Pulih", localDate: "2026-01-01" }, challenge: { id: "chal-1", title: "Ground", description: "Breathe slowly.", category: "grounding", localDate: "2026-01-01" } };
  const catalog: AchievementRecord[] = [{ id: "ach-1", key: "first_journal", title: "First Journal", description: "Write first journal.", criteria: { type: "journal_count", target: 1 }, createdAt: new Date().toISOString() }];
  const progress: AchievementProgressRecord[] = [{ achievement: catalog[0], progressValue: 1, unlockedAt: new Date().toISOString() }];
  return {
    async createJournal(input) { const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...input }; journals.push(row); return row; },
    async listJournals(userId) { return journals.filter((item) => item.userId === userId); },
    async createPost(input) { const row = { id: crypto.randomUUID(), likeCount: 0, commentCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...input }; posts.push(row); return row; },
    async listPosts() { return posts; },
    async createComment(input) { const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input }; comments.push(row); const post = posts.find((item) => item.id === input.postId); if (post) post.commentCount += 1; return row; },
    async listComments(postId) { return comments.filter((item) => item.postId === postId); },
    async likePost(postId, userId) { const key = `${postId}:${userId}`; if (!likes.has(key)) { likes.add(key); const post = posts.find((item) => item.id === postId); if (post) post.likeCount += 1; } return { liked: true }; },
    async listEducation() { return education; },
    async getDailyContent() { return daily; },
    async listAchievementCatalog() { return catalog; },
    async listAchievementProgress() { return progress; },
  };
}

async function authedApp(repository: ContentRepository) {
  const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
  const app = createApp(TEST_ENV, {}, { authRepository: { async createPatient() { throw new Error("not used"); }, async findByEmail() { return null; }, async findByUsername() { return null; }, async findByLoginIdentifier() { return null; }, async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; } }, contentRepository: repository });
  return { app, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } };
}

describe("content routes", () => {
  test("journals are owner-scoped", async () => {
    const repository = memoryRepository();
    await repository.createJournal({ userId: OTHER_USER_ID, content: "private" });
    const { app, headers } = await authedApp(repository);
    const create = await app.request("/api/v1/journals", { method: "POST", headers, body: JSON.stringify({ content: "my entry" }) });
    expect(create.status).toBe(201);
    const list = await app.request("/api/v1/journals", { headers });
    const body = await list.json() as any;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].content).toBe("my entry");
  });

  test("community like is idempotent", async () => {
    const repository = memoryRepository();
    const { app, headers } = await authedApp(repository);
    const post = await (await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "support", content: "hello" }) })).json() as any;
    await app.request(`/api/v1/community/${post.data.id}/like`, { method: "POST", headers });
    await app.request(`/api/v1/community/${post.data.id}/like`, { method: "POST", headers });
    const feed = await (await app.request("/api/v1/community", { headers })).json() as any;
    expect(feed.data[0].likeCount).toBe(1);
  });

  test("serves education, daily content, and achievements", async () => {
    const { app, headers } = await authedApp(memoryRepository());
    expect((await app.request("/api/v1/education", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/content/daily", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/achievements/catalog", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/achievements/progress", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/achievements/unlocked", { headers })).status).toBe(200);
  });
});
