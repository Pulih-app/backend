import { describe, expect, test } from "bun:test";
import { AppErrorCode } from "../../shared/errors";
import { createAiProvider } from "./ai-provider";

describe("AI provider", () => {
  test("maps successful non-streaming completion", async () => {
    const provider = createAiProvider({
      baseUrl: "https://ai.example/v1",
      apiKey: "test-key",
      model: "gpt-4o-mini",
      timeoutMs: 1000,
      maxTokens: 800,
      fetcher: (async (_url, init) => {
        expect(JSON.parse(String(init?.body)).stream).toBe(false);
        return new Response(JSON.stringify({ model: "mock-model", choices: [{ message: { content: " Hello " } }] }), { status: 200 });
      }) as typeof fetch,
    });
    await expect(provider.complete({ messages: [{ role: "user", content: "hi" }] })).resolves.toEqual({ content: "Hello", model: "mock-model" });
  });

  test("maps provider error", async () => {
    const provider = createAiProvider({ baseUrl: "https://ai.example/v1", apiKey: "test-key", model: "gpt-4o-mini", timeoutMs: 1000, maxTokens: 800, fetcher: (async () => new Response("", { status: 500 })) as unknown as typeof fetch });
    await expect(provider.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ code: AppErrorCode.DownstreamError });
  });

  test("maps timeout", async () => {
    const provider = createAiProvider({
      baseUrl: "https://ai.example/v1",
      apiKey: "test-key",
      model: "gpt-4o-mini",
      timeoutMs: 1,
      maxTokens: 800,
      fetcher: ((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))) as typeof fetch,
    });
    await expect(provider.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ code: AppErrorCode.ServiceUnavailable });
  });
});
