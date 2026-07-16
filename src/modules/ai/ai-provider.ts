import { AppError, AppErrorCode } from "../../shared/errors";

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };
export type AiProviderResponse = { content: string; model: string };
export type AiProvider = { complete(input: { messages: AiMessage[]; model?: string; maxTokens?: number }): Promise<AiProviderResponse> };

type AiProviderOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  fetcher?: typeof fetch;
};

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, done: () => clearTimeout(timeout) };
}

function mapAiResponse(input: unknown, fallbackModel: string): AiProviderResponse {
  const response = input as { model?: unknown; choices?: Array<{ message?: { content?: unknown } }> };
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AppError(AppErrorCode.DownstreamError, "AI provider response is invalid.");
  }
  return { content: content.trim(), model: typeof response.model === "string" ? response.model : fallbackModel };
}

function mapProviderError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof DOMException && error.name === "AbortError") {
    throw new AppError(AppErrorCode.ServiceUnavailable, "AI provider request timed out.");
  }
  throw new AppError(AppErrorCode.DownstreamError, "AI provider request failed.");
}

export function createAiProvider(options: AiProviderOptions): AiProvider {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;

  return {
    async complete(input) {
      const timeout = withTimeout(options.timeoutMs);
      const model = input.model ?? options.model;
      try {
        const response = await fetcher(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: timeout.controller.signal,
          body: JSON.stringify({
            model,
            messages: input.messages,
            stream: false,
            max_tokens: input.maxTokens ?? options.maxTokens,
          }),
        });
        if (!response.ok) throw new AppError(AppErrorCode.DownstreamError, "AI provider returned an error.");
        return mapAiResponse(await response.json(), model);
      } catch (error) {
        mapProviderError(error);
      } finally {
        timeout.done();
      }
    },
  };
}
