import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { validateJsonBody } from "../../shared/http/validation";
import { createSuccessResponse } from "../../shared/response";
import { authGuard, type AuthVariables } from "../auth/auth.middleware";
import { createAuthRepository, type AuthRepository } from "../auth/auth.repository";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createAiProvider, type AiProvider } from "./ai-provider";
import { createAiRepository, type AiRepository } from "./ai.repository";
import { createAiService, type AiService } from "./ai.service";
import { askCoachSchema, onboardingAnalysisSchema, personaPreferencesSchema, relapsePreventionPlanSchema, relapseSolutionSchema } from "./ai.schema";

export type AiRoutesOptions = { config: AppConfig; databaseSource?: DatabaseSource; authRepository?: AuthRepository; authService?: AuthService; aiRepository?: AiRepository; aiProvider?: AiProvider };

function defaultProvider(config: AppConfig) {
  const ai = config.ai ?? { baseUrl: "https://openrouter.ai/api/v1", apiKey: "local-ai-api-key", model: "google/gemini-2.5-flash-lite", timeoutMs: 10000, maxTokens: 800 };
  return createAiProvider({
    baseUrl: ai.baseUrl,
    apiKey: ai.apiKey,
    model: ai.model,
    timeoutMs: ai.timeoutMs,
    maxTokens: ai.maxTokens,
  });
}

async function withAiService<T>(options: AiRoutesOptions, action: (service: AiService, authService: AuthService) => Promise<T>) {
  if (options.aiRepository && (options.authService || options.authRepository)) {
    const authService = options.authService ?? createAuthService(options.authRepository!, options.config);
    return action(createAiService(options.aiRepository, options.aiProvider ?? defaultProvider(options.config)), authService);
  }
  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    return await action(createAiService(createAiRepository(handle.db), options.aiProvider ?? defaultProvider(options.config)), createAuthService(createAuthRepository(handle.db), options.config));
  } finally {
    await handle.close();
  }
}

async function requireAuth(context: any, options: AiRoutesOptions, service: AuthService) {
  const middleware = authGuard({ service, config: options.config });
  await middleware(context, async () => undefined);
  return context.get("auth").user;
}

export function createAiRoutes(options: AiRoutesOptions) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/ai/ask-coach", (context) => withAiService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, askCoachSchema);
    const data = await service.askCoach(auth.id, payload.message);
    return context.json(createSuccessResponse({ message: "AI coach response generated successfully", data }));
  }));

  routes.post("/ai/relapse-solution", (context) => withAiService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, relapseSolutionSchema);
    const data = await service.relapseSolution(auth.id, payload);
    return context.json(createSuccessResponse({ message: "Relapse solution generated successfully", data }));
  }));

  routes.post("/ai/relapse-prevention-plan", (context) => withAiService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, relapsePreventionPlanSchema);
    const data = await service.relapsePreventionPlan(auth.id, payload);
    return context.json(createSuccessResponse({ message: "Relapse prevention plan generated successfully", data }));
  }));

  routes.get("/ai/chat-history", (context) => withAiService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const limitRaw = context.req.query("limit");
    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
    const data = await service.listChatHistory(auth.id, isNaN(limit as number) ? undefined : limit);
    return context.json(createSuccessResponse({ message: "AI chat history retrieved successfully", data }));
  }));

  routes.get("/ai/summary", (context) => withAiService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.getSummary(auth.id);
    return context.json(createSuccessResponse({ message: "AI summary retrieved successfully", data }));
  }));

  routes.post("/ai/onboarding-analysis", (context) => withAiService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, onboardingAnalysisSchema);
    const data = await service.onboardingAnalysis(auth.id, payload);
    return context.json(createSuccessResponse({ message: "Onboarding analysis generated successfully", data }));
  }));

  routes.get("/ai/persona-preferences", (context) => withAiService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.getPersonaPreferences(auth.id);
    return context.json(createSuccessResponse({ message: "AI persona preferences retrieved successfully", data }));
  }));

  routes.put("/ai/persona-preferences", (context) => withAiService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, personaPreferencesSchema);
    const data = await service.updatePersonaPreferences(auth.id, payload);
    return context.json(createSuccessResponse({ message: "AI persona preferences updated successfully", data }));
  }));

  return routes;
}
