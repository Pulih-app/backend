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

export function hasCrisisSignal(text: string) {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildSafetySystemPrompt(input: { mode: "coach" | "relapse_solution" | "relapse_prevention" | "onboarding_analysis"; crisis: boolean }) {
  const task = {
    coach: "Support user with brief recovery coaching.",
    relapse_solution: "Help user respond to relapse risk with practical next steps.",
    relapse_prevention: "Create delay, distract, and decide guidance.",
    onboarding_analysis: "Summarize onboarding preferences into safe support guidance.",
  }[input.mode];

  return [
    "You are Pulih AI coach for recovery support.",
    task,
    "Do not diagnose, prescribe medication, or claim to replace psychologists, doctors, or emergency services.",
    "Use minimal context. Avoid repeating sensitive user details.",
    "Keep response concise, practical, compassionate, and non-judgmental.",
    input.crisis ? CRISIS_ESCALATION_COPY : "If crisis or immediate danger appears, provide emergency escalation guidance.",
  ].join(" ");
}

export function buildMessages(input: { mode: "coach" | "relapse_solution" | "relapse_prevention" | "onboarding_analysis"; userText: string; context?: string }) {
  const crisis = hasCrisisSignal(`${input.userText} ${input.context ?? ""}`);
  const messages: AiMessage[] = [
    { role: "system", content: buildSafetySystemPrompt({ mode: input.mode, crisis }) },
  ];
  if (input.context && input.context.trim().length > 0) {
    messages.push({ role: "user", content: `Context summary: ${input.context.trim()}` });
  }
  messages.push({ role: "user", content: input.userText.trim() });
  return { crisis, messages };
}

export function buildCrisisFallback() {
  return `${CRISIS_ESCALATION_COPY} Take one small safe step now: move away from immediate danger, breathe slowly, and message or call someone you trust.`;
}
