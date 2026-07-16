import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import { issueAccessToken } from "../auth/token";
import { AppErrorCode } from "../../shared/errors";
import { createAiProvider, type AiProvider } from "./ai-provider";
import type { AiRepository, AiChatRecord, AiPersonaPreferencesRecord } from "./ai.repository";
import { buildCoachMessages, CRISIS_ESCALATION_COPY, DEFAULT_PERSONA } from "./ai-safety";

const TEST_ENV = {
  APP_NAME: "pulih-api", APP_ENV: "local", NODE_ENV: "test", API_PREFIX: "/api/v1", APP_URL: "http://localhost:3000", PWA_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable", DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  JWT_ACCESS_SECRET: "test-secret", JWT_ACCESS_TTL_SECONDS: "86400", PASSWORD_HASH_COST: "4", CORS_ALLOWED_ORIGINS: "http://localhost:3001", REQUEST_ID_HEADER: "x-request-id", PAKASIR_API_KEY: "test-pakasir-key",
};
const AUTH_USER = { id: "11111111-1111-4111-8111-111111111111", email: "patient@example.com", username: null, role: "patient" as const, status: "active" };

type InternalChatRecord = AiChatRecord & { userId: string };

function memoryRepository(): AiRepository {
  const messages: InternalChatRecord[] = [];
  let preferences: AiPersonaPreferencesRecord | null = null;
  return {
    async createChatMessage(input) { const row: InternalChatRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), role: input.role, content: input.content, userId: input.userId }; messages.push(row); return row; },
    async listChatHistory(userId, limit) { const filtered = messages.filter((item) => item.userId === userId); const sliced = limit && limit < filtered.length ? filtered.slice(-limit) : filtered; return sliced.map(({ userId: _, ...rest }) => rest); },
    async getPersonaPreferences() { return preferences; },
    async upsertPersonaPreferences(input) { preferences = { persona: input.persona, updatedAt: new Date().toISOString() }; return preferences; },
  };
}

async function authedApp(repository: AiRepository, provider: AiProvider) {
  const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
  const app = createApp(TEST_ENV, {}, { authRepository: { async createPatient() { throw new Error("not used"); }, async findByEmail() { return null; }, async findByUsername() { return null; }, async findByLoginIdentifier() { return null; }, async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; } }, aiRepository: repository, aiProvider: provider });
  return { app, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } };
}

describe("AI safety", () => {
  test("crisis path includes escalation copy", () => {
    const result = buildCoachMessages({ userText: "I want to kill myself", persona: DEFAULT_PERSONA });
    expect(result.crisis).toBe(true);
    expect(result.messages[0].content).toContain(CRISIS_ESCALATION_COPY);
  });
});

describe("AI provider", () => {
  test("maps provider rate limits to service unavailable", async () => {
    const provider = createAiProvider({
      baseUrl: "https://ai.example.test/v1",
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 1000,
      maxTokens: 100,
      fetcher: (async () => new Response(JSON.stringify({ error: "rate limited" }), { status: 429 })) as unknown as typeof fetch,
    });

    await expect(provider.complete({ messages: [{ role: "user", content: "hello" }] })).rejects.toMatchObject({
      code: AppErrorCode.ServiceUnavailable,
      details: ["provider_status:429"],
    });
  });

  test("sends OpenRouter metadata headers when OpenRouter base URL is used", async () => {
    let headers: Headers | undefined;
    const provider = createAiProvider({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "test-key",
      model: "openai/gpt-4o-mini",
      timeoutMs: 1000,
      maxTokens: 100,
      fetcher: (async (_url: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => {
        headers = new Headers(init?.headers);
        return Response.json({ choices: [{ message: { content: "ok" } }] });
      }) as unknown as typeof fetch,
    });

    await provider.complete({ messages: [{ role: "user", content: "hello" }] });

    expect(headers?.get("HTTP-Referer")).toBe("https://pulih.app");
    expect(headers?.get("X-Title")).toBe("Pulih API");
  });
});

describe("AI routes", () => {
  test("ask coach returns response and persona_used", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "Try one safe small step.", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/ask-coach", { method: "POST", headers, body: JSON.stringify({ message: "I feel an urge" }) });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.data.response).toBe("Try one safe small step.");
    expect(body.data.persona_used).toBe(DEFAULT_PERSONA);
    expect(await repository.listChatHistory(AUTH_USER.id, 50)).toHaveLength(2);
  });

  test("ask coach uses stored persona preference", async () => {
    const repository = memoryRepository();
    await repository.upsertPersonaPreferences({ userId: AUTH_USER.id, persona: "friendly" });
    const provider: AiProvider = { async complete() { return { content: "Hey! You're doing great.", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/ask-coach", { method: "POST", headers, body: JSON.stringify({ message: "Hello" }) });
    const body = await response.json() as any;
    expect(body.data.persona_used).toBe("friendly");
  });

  test("relapse solution returns structured output", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = {
      async complete() {
        return { content: JSON.stringify({ title: "Regain Focus", analysis: "Stress is the main trigger in evening hours.", summary: "Remove trigger access during vulnerable windows." }), model: "mock" };
      },
    };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/relapse-solution", { method: "POST", headers, body: JSON.stringify({ mood: "stressed", relapse_trigger: ["work pressure"] }) });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.data.title).toBe("Regain Focus");
    expect(body.data.analysis).toBeDefined();
    expect(body.data.summary).toBeDefined();
  });

  test("relapse solution validates mood is required", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "ok", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/relapse-solution", { method: "POST", headers, body: JSON.stringify({}) });
    const body = await response.json() as any;
    expect(response.status).toBe(422);
  });

  test("relapse prevention plan returns structured output", async () => {
    let providerPrompt = "";
    const repository = memoryRepository();
    const provider: AiProvider = { async complete(input) { providerPrompt = input.messages.map((m) => m.content).join("\n"); return { content: "Delay: Wait 10 minutes\nDistract: Walk outside\nDecide: Call a trusted person", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/relapse-prevention-plan", { method: "POST", headers, body: JSON.stringify({ urgeLevel: 4, triggers: ["stress"], currentContext: "very private journal-like detail" }) });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.data.delay).toBe("Wait 10 minutes");
    expect(body.data.distract).toBe("Walk outside");
    expect(body.data.decide).toBe("Call a trusted person");
    expect(providerPrompt).toContain("User provided short current context.");
    expect(providerPrompt).not.toContain("very private journal-like detail");
  });

  test("onboarding analysis returns structured output", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = {
      async complete() {
        return { content: JSON.stringify({ level: "Moderate", title: "Building Consistency", level_description: "You need steady support.", pattern_analysis: "Motivation is good but rhythm is unstable.", encouragement: "Keep small daily steps." }), model: "mock" };
      },
    };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/onboarding-analysis", { method: "POST", headers, body: JSON.stringify({ answers: { reason: "Better focus", goal: 30 } }) });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.data.level).toBe("Moderate");
    expect(body.data.title).toBeDefined();
    expect(body.data.level_description).toBeDefined();
    expect(body.data.pattern_analysis).toBeDefined();
    expect(body.data.encouragement).toBeDefined();
  });

  test("onboarding analysis validates answers is required", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "ok", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/onboarding-analysis", { method: "POST", headers, body: JSON.stringify({}) });
    expect(response.status).toBe(422);
  });

  test("persona preferences can be read with default", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "ok", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const initial = await (await app.request("/api/v1/ai/persona-preferences", { headers })).json() as any;
    expect(initial.data.persona).toBe(DEFAULT_PERSONA);
    expect(initial.data.fallback_persona).toBe(DEFAULT_PERSONA);
  });

  test("persona preferences can be updated", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "ok", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const updated = await (await app.request("/api/v1/ai/persona-preferences", { method: "PUT", headers, body: JSON.stringify({ persona: "direct" }) })).json() as any;
    expect(updated.data.persona).toBe("direct");
    expect(updated.data.fallback_persona).toBe(DEFAULT_PERSONA);
  });

  test("persona preferences validates persona enum", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "ok", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/persona-preferences", { method: "PUT", headers, body: JSON.stringify({ persona: "invalid" }) });
    expect(response.status).toBe(422);
  });

  test("chat history supports limit query param", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "ok", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    // create some messages
    await repository.createChatMessage({ userId: AUTH_USER.id, role: "user", content: "msg1" });
    await repository.createChatMessage({ userId: AUTH_USER.id, role: "assistant", content: "reply1" });
    await repository.createChatMessage({ userId: AUTH_USER.id, role: "user", content: "msg2" });
    const response = await app.request("/api/v1/ai/chat-history?limit=2", { headers });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
  });

  test("chat history does not leak userId", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "ok", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    await repository.createChatMessage({ userId: AUTH_USER.id, role: "user", content: "msg1" });
    const response = await app.request("/api/v1/ai/chat-history", { headers });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.data[0].userId).toBeUndefined();
    expect(body.data[0].id).toBeDefined();
    expect(body.data[0].role).toBeDefined();
    expect(body.data[0].content).toBeDefined();
    expect(body.data[0].createdAt).toBeDefined();
  });

  test("summary returns summary text", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "User is making steady progress.", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/summary", { headers });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(typeof body.data.summary).toBe("string");
    expect(body.data.summary.length).toBeGreaterThan(0);
  });
});
