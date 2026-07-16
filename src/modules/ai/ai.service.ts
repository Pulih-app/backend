import { AppError, AppErrorCode } from "../../shared/errors";
import type { AiProvider } from "./ai-provider";
import {
  buildCoachMessages,
  buildCrisisFallback,
  buildOnboardingAnalysisMessages,
  buildPreventionMessages,
  buildRelapseSolutionMessages,
  DEFAULT_PERSONA,
  type Persona,
} from "./ai-safety";
import type { OnboardingAnalysisInput, PersonaPreferencesInput, RelapsePreventionPlanInput, RelapseSolutionInput } from "./ai.schema";
import type { AiRepository } from "./ai.repository";

export type AiService = ReturnType<typeof createAiService>;

export type AskCoachResponse = { response: string; persona_used: Persona };
export type RelapseSolutionResponse = { title: string; analysis: string; summary: string };
export type OnboardingAnalysisResponse = { level: "Low" | "Moderate" | "High"; title: string; level_description: string; pattern_analysis: string; encouragement: string };
export type PersonaPreferencesResponse = { persona: Persona; fallback_persona: Persona };

const DEFAULT_SUMMARY = "New insights for you will be available soon. Keep writing your daily journals!";

// ---------- JSON parsers ----------

export function parseOnboardingAnalysisResponse(raw: string): OnboardingAnalysisResponse {
  const parsed = parseStructuredJSON(raw);

  const level = String(parsed.level ?? "").trim();
  const title = String(parsed.title ?? "").trim();
  const levelDescription = String(parsed.level_description ?? "").trim();
  const patternAnalysis = String(parsed.pattern_analysis ?? "").trim();
  const encouragement = String(parsed.encouragement ?? "").trim();

  if (!["Low", "Moderate", "High"].includes(level)) throw new AppError(AppErrorCode.DownstreamError, "AI onboarding analysis returned invalid level.");
  if (!level || !title || !levelDescription || !patternAnalysis || !encouragement) throw new AppError(AppErrorCode.DownstreamError, "AI onboarding analysis response is incomplete.");

  return { level: level as "Low" | "Moderate" | "High", title, level_description: levelDescription, pattern_analysis: patternAnalysis, encouragement };
}

function parseRelapseSolutionJSON(raw: string): RelapseSolutionResponse {
  const parsed = parseStructuredJSON(raw);

  const title = String(parsed.title ?? "").trim();
  const analysis = String(parsed.analysis ?? "").trim();
  const summary = String(parsed.summary ?? "").trim();

  if (!title || !analysis || !summary) throw new AppError(AppErrorCode.DownstreamError, "AI relapse solution response is incomplete.");
  return { title, analysis, summary };
}

/** Safely parse JSON from AI, with markdown-stripping fallback. Always throws AppError on failure. */
function parseStructuredJSON(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) throw new AppError(AppErrorCode.DownstreamError, "AI response is empty.");

  let parsed: unknown;

  // Attempt 1: direct parse
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // ok, try extracting from markdown
  }

  // Attempt 2: extract {...} block from markdown/code fences
  if (parsed === undefined) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new AppError(AppErrorCode.DownstreamError, "AI response contains no valid JSON object.");
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new AppError(AppErrorCode.DownstreamError, "AI response JSON is malformed.");
    }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AppError(AppErrorCode.DownstreamError, "AI response is not a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function parsePreventionPlan(content: string) {
  return {
    delay: content.match(/delay\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "Wait 10 minutes before acting on the urge.",
    distract: content.match(/distract\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "Do a grounding activity for a few minutes.",
    decide: content.match(/decide\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "Choose the safest next step and contact support if needed.",
    raw: content,
  };
}

function resolvePersona(raw?: string | null): Persona {
  if (raw && ["supportive", "friendly", "concise", "direct"].includes(raw)) {
    return raw as Persona;
  }
  return DEFAULT_PERSONA;
}

async function downstreamGuard<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(AppErrorCode.DownstreamError, `AI ${label} failed.`);
  }
}

// ---------- Service factory ----------

export function createAiService(repository: AiRepository, provider: AiProvider) {
  return {
    askCoach(userId: string, message: string): Promise<AskCoachResponse> {
      return downstreamGuard("coach", async () => {
        const prefs = await repository.getPersonaPreferences(userId);
        const persona = resolvePersona(prefs?.persona);

        const { crisis, messages } = buildCoachMessages({ userText: message, persona });

        await repository.createChatMessage({ userId, role: "user", content: message });

        const response = crisis
          ? { content: buildCrisisFallback(), model: "safety" }
          : await provider.complete({ messages });

        await repository.createChatMessage({ userId, role: "assistant", content: response.content });

        return { response: response.content, persona_used: persona };
      });
    },

    relapseSolution(userId: string, input: RelapseSolutionInput): Promise<RelapseSolutionResponse> {
      return downstreamGuard("relapse solution", async () => {
        const { messages } = buildRelapseSolutionMessages(input);
        const response = await provider.complete({ messages, maxTokens: 500 });
        return parseRelapseSolutionJSON(response.content);
      });
    },

    relapsePreventionPlan(userId: string, input: RelapsePreventionPlanInput) {
      return downstreamGuard("prevention plan", async () => {
        const { crisis, messages } = buildPreventionMessages(input);
        const response = crisis
          ? { content: buildCrisisFallback(), model: "safety" }
          : await provider.complete({ messages });
        return parsePreventionPlan(response.content);
      });
    },

    onboardingAnalysis(_userId: string, input: OnboardingAnalysisInput): Promise<OnboardingAnalysisResponse> {
      return downstreamGuard("onboarding analysis", async () => {
        const { messages } = buildOnboardingAnalysisMessages(input);
        const response = await provider.complete({ messages, maxTokens: 500 });
        return parseOnboardingAnalysisResponse(response.content);
      });
    },

    async listChatHistory(userId: string, limit?: number) {
      const effectiveLimit = limit && limit >= 1 && limit <= 200 ? limit : 50;
      return repository.listChatHistory(userId, effectiveLimit);
    },

    async getSummary(userId: string) {
      const history = await repository.listChatHistory(userId, 20);
      if (history.length === 0) return { summary: DEFAULT_SUMMARY };

      try {
        const chatSummary = history.map((item) => `${item.role}: ${item.content.substring(0, 100)}`).join("\n");
        const { messages } = buildCoachMessages({
          userText: "Based on recent conversations, give a 2-sentence summary of the user's recovery progress.",
          persona: DEFAULT_PERSONA,
          context: `Recent chat history:\n${chatSummary}`,
        });
        const response = await provider.complete({ messages, maxTokens: 200 });
        return { summary: response.content.trim() || DEFAULT_SUMMARY };
      } catch {
        return { summary: DEFAULT_SUMMARY };
      }
    },

    async getPersonaPreferences(userId: string): Promise<PersonaPreferencesResponse> {
      const prefs = await repository.getPersonaPreferences(userId);
      return {
        persona: resolvePersona(prefs?.persona),
        fallback_persona: DEFAULT_PERSONA,
      };
    },

    async updatePersonaPreferences(userId: string, input: PersonaPreferencesInput): Promise<PersonaPreferencesResponse> {
      await repository.upsertPersonaPreferences({ userId, persona: input.persona });
      return {
        persona: input.persona,
        fallback_persona: DEFAULT_PERSONA,
      };
    },
  };
}
