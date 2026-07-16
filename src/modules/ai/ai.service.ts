import type { AiProvider } from "./ai-provider";
import { buildCrisisFallback, buildMessages, CRISIS_ESCALATION_COPY } from "./ai-safety";
import type { OnboardingAnalysisInput, PersonaPreferencesInput, RelapsePreventionPlanInput, RelapseSolutionInput } from "./ai.schema";
import type { AiRepository } from "./ai.repository";

export type AiService = ReturnType<typeof createAiService>;

function safeJoin(items?: string[]) {
  return items?.slice(0, 5).map((item) => item.trim()).filter(Boolean).join(", ");
}

function parsePreventionPlan(content: string) {
  return {
    delay: content.match(/delay\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "Wait 10 minutes before acting on the urge.",
    distract: content.match(/distract\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "Do a grounding activity for a few minutes.",
    decide: content.match(/decide\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "Choose the safest next step and contact support if needed.",
    raw: content,
  };
}

export function createAiService(repository: AiRepository, provider: AiProvider) {
  async function complete(userId: string, mode: "coach" | "relapse_solution" | "relapse_prevention" | "onboarding_analysis", userText: string, context?: string) {
    const { crisis, messages } = buildMessages({ mode, userText, context });
    await repository.createChatMessage({ userId, role: "user", content: userText });
    const response = crisis
      ? { content: buildCrisisFallback(), model: "safety" }
      : await provider.complete({ messages });
    await repository.createChatMessage({ userId, role: "assistant", content: response.content });
    return { message: response.content, model: response.model, crisisEscalation: crisis ? CRISIS_ESCALATION_COPY : null };
  }

  return {
    askCoach(userId: string, message: string) {
      return complete(userId, "coach", message);
    },
    relapseSolution(userId: string, input: RelapseSolutionInput) {
      return complete(userId, "relapse_solution", input.situation, safeJoin(input.triggers) ? `Triggers: ${safeJoin(input.triggers)}` : undefined);
    },
    async relapsePreventionPlan(userId: string, input: RelapsePreventionPlanInput) {
      const triggerSummary = safeJoin(input.triggers);
      const context = [`Urge level: ${input.urgeLevel}/5`, triggerSummary ? `Trigger categories: ${triggerSummary}` : undefined, input.currentContext ? "User provided short current context." : undefined].filter(Boolean).join(" ");
      const prompt = "Return exactly three short lines in this format: Delay: ... Distract: ... Decide: ...";
      const response = await complete(userId, "relapse_prevention", prompt, context);
      return { ...parsePreventionPlan(response.message), crisisEscalation: response.crisisEscalation };
    },
    onboardingAnalysis(userId: string, input: OnboardingAnalysisInput) {
      const context = [
        input.recoveryGoal ? "Recovery goal was provided." : undefined,
        safeJoin(input.concerns) ? `Concern categories: ${safeJoin(input.concerns)}` : undefined,
        input.preferredSupport ? `Preferred support: ${input.preferredSupport}` : undefined,
      ].filter(Boolean).join(" ");
      return complete(userId, "onboarding_analysis", "Create a brief recovery support summary.", context);
    },
    listChatHistory(userId: string) {
      return repository.listChatHistory(userId, 50);
    },
    async getSummary(userId: string) {
      const history = await repository.listChatHistory(userId, 20);
      return { totalMessages: history.length, lastMessageAt: history.at(-1)?.createdAt ?? null };
    },
    async getPersonaPreferences(userId: string) {
      return await repository.getPersonaPreferences(userId) ?? { userId, tone: "balanced" as const, focusAreas: [], updatedAt: null };
    },
    updatePersonaPreferences(userId: string, input: PersonaPreferencesInput) {
      return repository.upsertPersonaPreferences({ userId, ...input });
    },
  };
}
