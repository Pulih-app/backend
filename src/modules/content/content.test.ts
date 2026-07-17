import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import { issueAccessToken } from "../auth/token";
import type { ContentRepository, JournalRecord, CommunityPostRecord, CommunityCommentRecord, CommunityCommentNode, CommunityThreadRecord, AchievementRecord, AchievementProgressRecord, EducationRecord, DailyContentRecord } from "./content.repository";

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
  const likes = new Map<string, boolean>();
  const education: EducationRecord[] = [
    { id: "edu-1", title: "Safe Recovery", description: "Small safe steps.", url: "https://example.com/recovery", thumbnailUrl: null, category: "recovery", type: "artikel", publishedAt: new Date().toISOString() },
  ];
  const dailyContent: DailyContentRecord = {
    date: "2026-01-01",
    motivation: "Stay steady.",
    challenge: { title: "Ground", description: "Breathe slowly." },
    physicalChallenge: { title: "Light Movement", description: "Walk 10 minutes." },
  };
  const catalog: AchievementRecord[] = [{ id: "ach-1", key: "first_journal", title: "First Journal", description: "Write first journal.", criteria: { type: "journal_count", target: 1 }, createdAt: new Date().toISOString() }];
  const progress: AchievementProgressRecord[] = [{ achievement: catalog[0], progressValue: 1, unlockedAt: new Date().toISOString() }];
  const motivations: { id: string; content: string; isActive: boolean; createdAt: Date }[] = [
    { id: "mot-1", content: "Stay steady.", isActive: true, createdAt: new Date() },
    { id: "mot-2", content: "Keep moving forward.", isActive: true, createdAt: new Date() },
  ];
  const challenges: { id: string; title: string; description: string; content: string; isActive: boolean; createdAt: Date }[] = [
    { id: "chal-1", title: "Ground", description: "Breathe slowly.", content: "Breathe exercise", isActive: true, createdAt: new Date() },
  ];
  const physicalChallenges: { id: string; title: string; description: string; isActive: boolean; createdAt: Date }[] = [
    { id: "phy-1", title: "Light Movement", description: "Walk 10 minutes.", isActive: true, createdAt: new Date() },
  ];

  function computeLikeCount(postId: string) {
    let count = 0;
    for (const [key, liked] of likes) {
      if (liked && key.startsWith(`${postId}:`)) count++;
    }
    return count;
  }

  return {
    async createJournal(input) { const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...input }; journals.push(row); return row; },
    async listJournals(userId) { return journals.filter((item) => item.userId === userId); },

    async createPost(input) {
      const row: CommunityPostRecord = {
        id: crypto.randomUUID(), userId: input.userId, title: input.title ?? null,
        category: input.category, content: input.content,
        likeCount: 0, commentCount: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        author: { nickname: "testuser", currentStreak: 0 },
      };
      posts.push(row);
      return row;
    },
    async listPosts(filter) {
      if (filter?.category) return posts.filter((p) => p.category === filter.category);
      return [...posts].reverse();
    },

    async createComment(input) {
      const row: CommunityCommentRecord = {
        id: crypto.randomUUID(), postId: input.postId, userId: input.userId,
        parentCommentId: null, content: input.content, depth: 0, replyCount: 0,
        createdAt: new Date().toISOString(),
      };
      comments.push(row);
      const post = posts.find((item) => item.id === input.postId);
      if (post) post.commentCount += 1;
      return row;
    },
    async listComments(postId) { return comments.filter((item) => item.postId === postId); },
    async listCommentThread(postId) {
      const postComments = comments.filter((c) => c.postId === postId);
      const thread: CommunityThreadRecord = { postId, comments: buildTree(postComments) };
      return thread;
    },

    async createReply(input) {
      const parent = comments.find((c) => c.id === input.parentCommentId);
      if (!parent) throw new Error("Parent comment not found");
      if (parent.postId !== input.postId) throw new Error("Parent comment does not belong to this post");
      const depth = parent.depth + 1;
      if (depth > 2) throw new Error("Maximum thread depth of 2 exceeded");
      const row: CommunityCommentRecord = {
        id: crypto.randomUUID(), postId: input.postId, userId: input.userId,
        parentCommentId: input.parentCommentId, content: input.content,
        depth, replyCount: 0, createdAt: new Date().toISOString(),
      };
      comments.push(row);
      parent.replyCount += 1;
      const post = posts.find((item) => item.id === input.postId);
      if (post) post.commentCount += 1;
      return row;
    },

    async toggleLike(postId, userId) {
      const key = `${postId}:${userId}`;
      const isLiked = likes.get(key) ?? false;
      if (isLiked) {
        likes.delete(key);
      } else {
        likes.set(key, true);
      }
      return { likedCount: computeLikeCount(postId), isLiked: !isLiked };
    },

    async findUserById(userId: string) {
      if (userId === AUTH_USER.id) return { id: AUTH_USER.id };
      return null;
    },
    async listEducation() { return education; },
    async listActiveMotivations() { return motivations; },
    async listActiveChallenges() { return challenges; },
    async listActivePhysicalChallenges() { return physicalChallenges; },
    async getDailyContent() { return dailyContent; },
    async listAchievementCatalog() { return catalog; },
    async listAchievementProgress() { return progress; },
  };
}

function buildTree(flat: CommunityCommentRecord[]): CommunityCommentNode[] {
  const byId = new Map<string, CommunityCommentNode>();
  const roots: CommunityCommentNode[] = [];
  for (const c of flat) byId.set(c.id, { ...c, replies: [] });
  for (const c of flat) {
    const node = byId.get(c.id)!;
    if (c.parentCommentId && byId.has(c.parentCommentId)) {
      byId.get(c.parentCommentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

async function authedApp(repository: ContentRepository) {
  const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
  const app = createApp(TEST_ENV, {}, {
    authRepository: { async createUser() { throw new Error("not used"); }, async createPatient() { throw new Error("not used"); }, async findByEmail() { return null; }, async findByUsername() { return null; }, async findByLoginIdentifier() { return null; }, async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; } },
    contentRepository: repository,
  });
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

  describe("community", () => {
    test("creates post with title and 5 English categories", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);

      const res = await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ title: "My Story", category: "story", content: "This is my recovery story with enough length." }) });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.title).toBe("My Story");
      expect(body.data.category).toBe("story");
      expect(body.data.author).toBeDefined();
      expect(body.data.author.nickname).toBeDefined();
    });

    test("rejects invalid category", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);
      const res = await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "invalid", content: "test content with min length" }) });
      expect(res.status).toBe(422);
    });

    test("rejects post content shorter than 10 chars", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);
      const res = await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "advice", content: "short" }) });
      expect(res.status).toBe(422);
    });

    test("lists posts with category filter", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);
      await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "advice", content: "This is advice content with enough length." }) });
      await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "help", content: "This is help content with enough length." }) });

      const all = await (await app.request("/api/v1/community", { headers })).json() as any;
      expect(all.data).toHaveLength(2);

      const filtered = await (await app.request("/api/v1/community?category=advice", { headers })).json() as any;
      expect(filtered.data).toHaveLength(1);
      expect(filtered.data[0].category).toBe("advice");
    });

    test("like toggles correctly", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);

      const post = await (await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "story", content: "Content for like test with enough length." }) })).json() as any;

      const like1 = await (await app.request(`/api/v1/community/${post.data.id}/like`, { method: "POST", headers })).json() as any;
      expect(like1.data.isLiked).toBe(true);
      expect(like1.data.likedCount).toBe(1);

      const like2 = await (await app.request(`/api/v1/community/${post.data.id}/like`, { method: "POST", headers })).json() as any;
      expect(like2.data.isLiked).toBe(false);
      expect(like2.data.likedCount).toBe(0);

      const like3 = await (await app.request(`/api/v1/community/${post.data.id}/like`, { method: "POST", headers })).json() as any;
      expect(like3.data.isLiked).toBe(true);
      expect(like3.data.likedCount).toBe(1);
    });

    test("comment thread returns tree structure", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);

      const post = await (await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "question", content: "Has anyone tried this approach for recovery?" }) })).json() as any;
      const comment = await (await app.request(`/api/v1/community/${post.data.id}/comments`, { method: "POST", headers, body: JSON.stringify({ content: "Yes I have tried it" }) })).json() as any;
      const replyRes = await app.request(`/api/v1/community/${post.data.id}/comments/${comment.data.id}/replies`, { method: "POST", headers, body: JSON.stringify({ content: "How did it go?" }) });
      const reply = await replyRes.json() as any;

      expect(replyRes.status).toBe(201);
      expect(reply.data.parentCommentId).toBe(comment.data.id);
      expect(reply.data.depth).toBe(1);

      const thread = await (await app.request(`/api/v1/community/${post.data.id}/comments`, { headers })).json() as any;
      expect(thread.data.postId).toBe(post.data.id);
      expect(thread.data.comments).toHaveLength(1);
      expect(thread.data.comments[0].replies).toHaveLength(1);
      expect(thread.data.comments[0].replies[0].content).toBe("How did it go?");
    });

    test("empty comment thread returns empty comments array", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);

      const post = await (await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "story", content: "This is a story post with enough length." }) })).json() as any;
      const response = await app.request(`/api/v1/community/${post.data.id}/comments`, { headers });
      const thread = await response.json() as any;
      expect(response.status).toBe(200);
      expect(thread.data.postId).toBe(post.data.id);
      expect(thread.data.comments).toEqual([]);
    });

    test("rejects reply exceeding max thread depth", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);

      const post = await (await app.request("/api/v1/community", { method: "POST", headers, body: JSON.stringify({ category: "motivation", content: "Keep going, you can do this!" }) })).json() as any;
      const c1 = await (await app.request(`/api/v1/community/${post.data.id}/comments`, { method: "POST", headers, body: JSON.stringify({ content: "Thanks for the support" }) })).json() as any;
      const r1Res = await app.request(`/api/v1/community/${post.data.id}/comments/${c1.data.id}/replies`, { method: "POST", headers, body: JSON.stringify({ content: "You are welcome" }) });
      const r1 = await r1Res.json() as any;
      const r2Res = await app.request(`/api/v1/community/${post.data.id}/comments/${r1.data.id}/replies`, { method: "POST", headers, body: JSON.stringify({ content: "This should be depth 2" }) });
      const r2 = await r2Res.json() as any;
      expect(r2Res.status).toBe(201);

      const r3 = await app.request(`/api/v1/community/${post.data.id}/comments/${r2.data.id}/replies`, { method: "POST", headers, body: JSON.stringify({ content: "This is too deep now" }) });
      expect(r3.status).toBe(422);
    });
  });

  describe("education", () => {
    test("returns education with Recova-aligned shape", async () => {
      const { app, headers } = await authedApp(memoryRepository());
      const res = await app.request("/api/v1/education", { headers });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toBeArray();
      expect(body.data[0].id).toBe("edu-1");
      expect(body.data[0].title).toBe("Safe Recovery");
      expect(body.data[0].description).toBe("Small safe steps.");
      expect(body.data[0].url).toBe("https://example.com/recovery");
      expect(body.data[0].type).toBe("artikel");
    });

    test("returns 404 for unknown user", async () => {
      const repository = memoryRepository();
      // Override findUserById to return null for this user
      const origFindUserById = repository.findUserById.bind(repository);
      repository.findUserById = async (id: string) => {
        if (id === "99999999-9999-4999-8999-999999999999") return null;
        return origFindUserById(id);
      };
      const token = await issueAccessToken({ user: { ...AUTH_USER, id: "99999999-9999-4999-8999-999999999999", email: "unknown@test.com" }, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
      const app = createApp(TEST_ENV, {}, {
        authRepository: { async createUser() { throw new Error("not used"); }, async createPatient() { throw new Error("not used"); }, async findByEmail() { return null; }, async findByUsername() { return null; }, async findByLoginIdentifier() { return null; }, async findById(id: string) { return id === "99999999-9999-4999-8999-999999999999" ? { id, email: "unknown@test.com", username: null, role: "patient" as const, status: "active", passwordHash: "hash" } : null; } },
        contentRepository: repository,
      });
      const res = await app.request("/api/v1/education", { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
      expect(res.status).toBe(404);
    });
  });

  describe("daily content", () => {
    test("returns daily content with Recova-aligned shape", async () => {
      const { app, headers } = await authedApp(memoryRepository());
      const res = await app.request("/api/v1/content/daily", { headers });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.date).toBeString();
      expect(body.data.motivation).toBeString();
      expect(body.data.challenge.title).toBeString();
      expect(body.data.challenge.description).toBeString();
      expect(body.data.physicalChallenge.title).toBeString();
      expect(body.data.physicalChallenge.description).toBeString();
    });

    test("daily content uses fallback when no active items", async () => {
      const repository = memoryRepository();
      // Override with empty lists
      (repository as any).listActiveMotivations = async () => [];
      (repository as any).listActiveChallenges = async () => [];
      (repository as any).listActivePhysicalChallenges = async () => [];
      const { app, headers } = await authedApp(repository);
      const res = await app.request("/api/v1/content/daily", { headers });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.motivation).toBeString();
      expect(body.data.motivation.length).toBeGreaterThan(0);
      expect(body.data.challenge.title).toBeString();
      expect(body.data.challenge.description).toBeString();
      expect(body.data.physicalChallenge.title).toBeString();
      expect(body.data.physicalChallenge.description).toBeString();
    });

    test("daily content uses deterministic rotation", async () => {
      const repository = memoryRepository();
      const { app, headers } = await authedApp(repository);
      const res1 = await app.request("/api/v1/content/daily", { headers });
      const res2 = await app.request("/api/v1/content/daily", { headers });
      const body1 = await res1.json() as any;
      const body2 = await res2.json() as any;
      // Same date should return same content (deterministic)
      expect(body1.data.date).toBe(body2.data.date);
      expect(body1.data.motivation).toBe(body2.data.motivation);
    });
  });

  test("serves achievements endpoints", async () => {
    const { app, headers } = await authedApp(memoryRepository());
    expect((await app.request("/api/v1/achievements/catalog", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/achievements/progress", { headers })).status).toBe(200);
    expect((await app.request("/api/v1/achievements/unlocked", { headers })).status).toBe(200);
  });
});
