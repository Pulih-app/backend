import type { AiMessage } from "./ai-provider";

const CRISIS_PATTERNS = [
  /\bsuicide\b/i,
  /\bkill myself\b/i,
  /\bend my life\b/i,
  /\bself[- ]?harm\b/i,
  /\bhurt myself\b/i,
  /\bhurt someone\b/i,
  /\bemergency\b/i,
  /\bbunuh diri\b/i,
  /\bmenyakiti diri\b/i,
];

export const CRISIS_ESCALATION_COPY = "If you may harm yourself or someone else, contact local emergency services now or reach a trusted person nearby. Pulih is not emergency care.";

export const DEFAULT_PERSONA: "supportive" = "supportive";
export const ALLOWED_PERSONAS = ["supportive", "friendly", "concise", "direct"] as const;
export type Persona = (typeof ALLOWED_PERSONAS)[number];

export function hasCrisisSignal(text: string) {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

const COACH_SYSTEM_PROMPT = `You are Pulih AI Coach, a recovery companion for building healthier routines. Always respond in English (unless the user requests another language).
Focus: recovery support, trigger identification, urge management, prevention planning, and relapse recovery. Warm, non-judgmental, but firm and to-the-point.

RESPONSE RULES (REQUIRED)
- Do not self-introduce repeatedly. Answer the user's question first.
- Do not repeat content from previous answers unless user asks for summary/clarification.
- Max 6 sentences OR max 6 bullet points (choose one; do not mix).
- When relevant, add 1 small actionable step after the core answer.
- If the question is purely informational (e.g. "who are you", "what can you do"), just answer concisely; do not force exercises.
- At most 1 follow-up question (optional).

BOUNDARIES & SAFETY
- Do not request or provide explicit pornographic details.
- Do not give medical diagnoses or shame/blame the user.
- If crisis/self-harm indicators appear: direct to local emergency help/professionals.
- If topic is outside recovery: decline briefly and redirect to recovery.
- Do not output internal metadata (e.g. signature_id, recova.persona.*).
- Stay consistent with the active persona style.`;

function buildCoachPersonaInstruction(persona: Persona): string {
  switch (persona) {
    case "friendly":
      return "Active persona: friendly. Be casual, warm, and reassuring. Use light conversational tone. Keep it approachable.";
    case "concise":
      return "Active persona: concise. Be brief and precise. Max 3 short sentences or 3 bullets. No extra fluff.";
    case "direct":
      return "Active persona: direct. Be clear and action-oriented. Use numbered steps (1-3) when action is needed. No softening.";
    default: // supportive
      return "Active persona: supportive. Validate emotions first, then offer one realistic suggestion. Be calming and hopeful.";
  }
}

export function buildCoachMessages(input: { userText: string; persona: Persona; context?: string }) {
  const crisis = hasCrisisSignal(`${input.userText} ${input.context ?? ""}`);
  const personaInstruction = buildCoachPersonaInstruction(input.persona);
  const messages: AiMessage[] = [
    { role: "system", content: `${COACH_SYSTEM_PROMPT}\n\n${personaInstruction}\n${crisis ? `\nCRISIS NOTE: ${CRISIS_ESCALATION_COPY}` : ""}` },
  ];
  if (input.context && input.context.trim().length > 0) {
    messages.push({ role: "user", content: `Context: ${input.context.trim()}` });
  }
  messages.push({ role: "user", content: input.userText.trim() });
  return { crisis, messages };
}

const ONBOARDING_SYSTEM_PROMPT = `You are a Pulih onboarding analyst. Respond ONLY with valid JSON, no markdown.
Required schema:
{"level":"Low|Moderate|High","title":"...","level_description":"...","pattern_analysis":"...","encouragement":"..."}
Rules:
- "level" must be one of: "Low", "Moderate", or "High".
- All fields must be in English, supportive tone, non-judgmental.
- level_description: explain what this dependency level means for the user.
- pattern_analysis: identify key patterns from the answers.
- encouragement: realistic, hopeful next-step guidance.`;

export function buildOnboardingAnalysisMessages(input: { answers: Record<string, unknown> }) {
  const keys = Object.keys(input.answers).sort();
  const lines = keys.map((key) => `- ${key}: ${formatAnswerValue(input.answers[key])}`);
  const userPrompt = `Analyze these onboarding answers briefly:\n${lines.join("\n")}\n\nClassify dependency level (Low|Moderate|High) and provide realistic encouragement.`;
  const messages: AiMessage[] = [
    { role: "system", content: ONBOARDING_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];
  return { crisis: false, messages };
}

const RELAPSE_SOLUTION_SYSTEM_PROMPT = `You are a Pulih relapse coach. Respond ONLY with valid JSON, no markdown.
Required schema:
{"title":"...","analysis":"...","summary":"..."}
Rules:
- All fields in English, brief, supportive, non-judgmental.
- "analysis": identify the dominant trigger pattern (emotional context, situation, vulnerable timing if available).
- "summary": best relevant solution for the current primary trigger.
- Avoid explicit sexual details.
- If triggers are empty, still provide safe general analysis and safest solution.`;

export function buildRelapseSolutionMessages(input: { mood: string; relapse_trigger?: string[]; commitment?: string }) {
  const triggerText = input.relapse_trigger?.length ? input.relapse_trigger.join(", ") : "not specified";
  const commitmentText = input.commitment?.trim() || "no additional notes";
  const userPrompt = `Analyze this relapse event:\n- mood: ${input.mood}\n- relapse triggers: ${triggerText}\n- user notes: ${commitmentText}\n\nOutput the dominant trigger analysis and the single most relevant solution.`;
  const messages: AiMessage[] = [
    { role: "system", content: RELAPSE_SOLUTION_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];
  return { crisis: false, messages };
}

export function buildPreventionMessages(input: { urgeLevel: number; triggers?: string[]; currentContext?: string }) {
  const triggerSummary = input.triggers?.slice(0, 5).map((t) => t.trim()).filter(Boolean).join(", ");
  const contextParts = [`Urge level: ${input.urgeLevel}/5`];
  if (triggerSummary) contextParts.push(`Trigger categories: ${triggerSummary}`);
  if (input.currentContext) contextParts.push("User provided short current context.");
  const context = contextParts.join(" ");

  const systemPrompt = `You are Pulih AI coach for relapse prevention. ${CRISIS_ESCALATION_COPY}`;
  const crisis = hasCrisisSignal(`${context} ${input.currentContext ?? ""}`);
  const messages: AiMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Context: ${context}` },
    { role: "user", content: "Return exactly three short lines in this format: Delay: ... Distract: ... Decide: ..." },
  ];
  return { crisis, messages };
}

/** @deprecated Use buildRelapseSolutionMessages instead */
export function buildSafetySystemPrompt(input: { mode: string; crisis: boolean }) {
  if (input.mode === "relapse_solution") {
    return RELAPSE_SOLUTION_SYSTEM_PROMPT;
  }
  return "You are Pulih AI coach for recovery support. Do not diagnose or prescribe. Keep response concise and supportive.";
}

export function buildCrisisFallback() {
  return `${CRISIS_ESCALATION_COPY} Take one small safe step now: move away from immediate danger, breathe slowly, and message or call someone you trust.`;
}

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value.trim() || "(empty)";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatAnswerValue).join(", ");
  return JSON.stringify(value);
}
