import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import { issueAccessToken } from "../auth/token";
import type { AiProvider } from "./ai-provider";
import type { AiRepository, AiChatRecord, AiPersonaPreferencesRecord } from "./ai.repository";
import { buildMessages, CRISIS_ESCALATION_COPY } from "./ai-safety";

const TEST_ENV = {
  APP_NAME: "pulih-api", APP_ENV: "local", NODE_ENV: "test", API_PREFIX: "/api/v1", APP_URL: "http://localhost:3000", PWA_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable", DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  JWT_ACCESS_SECRET: "test-secret", JWT_ACCESS_TTL_SECONDS: "86400", PASSWORD_HASH_COST: "4", CORS_ALLOWED_ORIGINS: "http://localhost:3001", REQUEST_ID_HEADER: "x-request-id", PAKASIR_API_KEY: "test-pakasir-key",
};
const AUTH_USER = { id: "11111111-1111-4111-8111-111111111111", email: "patient@example.com", role: "patient" as const, status: "active" };

function memoryRepository(): AiRepository {
  const messages: AiChatRecord[] = [];
  let preferences: AiPersonaPreferencesRecord | null = null;
  return {
    async createChatMessage(input) { const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input }; messages.push(row); return row; },
    async listChatHistory(userId) { return messages.filter((item) => item.userId === userId); },
    async getPersonaPreferences() { return preferences; },
    async upsertPersonaPreferences(input) { preferences = { ...input, updatedAt: new Date().toISOString() }; return preferences; },
  };
}

async function authedApp(repository: AiRepository, provider: AiProvider) {
  const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
  const app = createApp(TEST_ENV, {}, { authRepository: { async createPatient() { throw new Error("not used"); }, async findByEmail() { return null; }, async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; } }, aiRepository: repository, aiProvider: provider });
  return { app, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } };
}

describe("AI safety", () => {
  test("crisis path includes escalation copy", () => {
    const result = buildMessages({ mode: "coach", userText: "I want to kill myself" });
    expect(result.crisis).toBe(true);
    expect(result.messages[0].content).toContain(CRISIS_ESCALATION_COPY);
  });
});

describe("AI routes", () => {
  test("ask coach stores chat and uses mocked provider", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "Try one safe small step.", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const response = await app.request("/api/v1/ai/ask-coach", { method: "POST", headers, body: JSON.stringify({ message: "I feel an urge" }) });
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.data.message).toBe("Try one safe small step.");
    expect(await repository.listChatHistory(AUTH_USER.id, 50)).toHaveLength(2);
  });

  test("relapse prevention plan returns structured minimized output", async () => {
    let providerPrompt = "";
    const repository = memoryRepository();
    const provider: AiProvider = { async complete(input) { providerPrompt = input.messages.map((message) => message.content).join("\n"); return { content: "Delay: Wait 10 minutes\nDistract: Walk outside\nDecide: Call a trusted person", model: "mock" }; } };
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

  test("persona preferences can be read and updated", async () => {
    const repository = memoryRepository();
    const provider: AiProvider = { async complete() { return { content: "ok", model: "mock" }; } };
    const { app, headers } = await authedApp(repository, provider);
    const initial = await (await app.request("/api/v1/ai/persona-preferences", { headers })).json() as any;
    expect(initial.data.tone).toBe("balanced");
    const updated = await (await app.request("/api/v1/ai/persona-preferences", { method: "PUT", headers, body: JSON.stringify({ tone: "gentle", focusAreas: ["stress"] }) })).json() as any;
    expect(updated.data.tone).toBe("gentle");
  });
});
