import { AppError, AppErrorCode } from "../../shared/errors";
import type { CheckInInput, RelapseInput } from "./routine.schema";
import type { RoutineRepository, CheckInRecord, RelapseRecord } from "./routine.repository";
import type { AiProvider } from "../ai/ai-provider";
import { buildSafetySystemPrompt, hasCrisisSignal, CRISIS_ESCALATION_COPY } from "../ai/ai-safety";

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const INDONESIAN_DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function getJakartaLocalDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JAKARTA_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// ── Payload types matching reference ──

export type CheckInPayload = {
  id: string;
  user_id: string;
  check_in_date: string;
  check_in_day_name: string;
  mood: string;
  is_successful: boolean;
  commitment: string | null;
  relapse_trigger: string[];
  created_at: string;
};

export type StatisticsPayload = {
  current_streak: number;
  longest_streak: number;
  total_checkins: number;
  total_attempts: number;
  success_rate: number;
  streak_calendar: string[];
  relapse_calendar: string[];
  relapse_count: number;
  relapse_rate: number;
  recovery_success_rate: number;
  checkin_consistency_score: number;
  weekly_progress: ProgressPayload;
  monthly_progress: ProgressPayload;
  mood_trend: MoodTrendPayload[];
  last_check_in_date: string | null;
  last_check_in_day_name: string | null;
  last_relapse_date: string | null;
  last_relapse_day_name: string | null;
  weekday_summary: WeekdaySummaryPayload[];
  streak_goal_comparison: StreakGoalComparisonPayload;
};

export type ProgressPayload = {
  window_days: number;
  current_successful_checkins: number;
  previous_successful_checkins: number;
  delta: number;
  delta_rate: number;
};

export type MoodTrendPayload = {
  date: string;
  day_name: string;
  dominant_mood: string;
  successful_ratio: number;
};

export type WeekdaySummaryPayload = {
  day_name: string;
  successful_checkins: number;
  relapse_count: number;
  total_checkins: number;
  success_rate: number;
};

export type StreakGoalComparisonPayload = {
  porn_free_goal: number | null;
  current_streak: number;
  longest_streak: number;
  goal_reached: boolean;
  remaining_days: number | null;
  progress_rate: number;
};

export type ActivitySummaryPayload = {
  window_days: number;
  successful_checkins: number;
  relapses: number;
  active_days: number;
  recent_activity: ActivityItemPayload[];
};

export type ActivityItemPayload = {
  date: string;
  day_name: string;
  type: string;
  mood?: string;
};

export type RelapsePayload = {
  id: string;
  user_id: string;
  relapse_date: string;
  relapse_day_name: string;
  mood: string;
  commitment: string | null;
  relapse_trigger: string[];
  check_in_id: string | null;
  created_at: string;
};

export type RelapseSolutionPayload = {
  title: string;
  analysis: string;
  summary: string;
  generated_at: string;
};

export type RelapseHourStatPayload = {
  hour_utc: number;
  relapse_count: number;
};

export type RelapseTriggerStatPayload = {
  relapse_trigger: string;
  relapse_trigger_count: number;
};

export type RelapseTimeSummaryPayload = {
  title: string;
  analysis: string;
  summary: string;
  generated_at: string;
};

export type CheckInResponseData = {
  check_in: CheckInPayload;
  statistics: StatisticsPayload;
  relapse_solution: null;
};

export type RelapseResponseData = {
  relapse: RelapsePayload;
  statistics: StatisticsPayload;
  relapse_solution: RelapseSolutionPayload;
};

export type RelapseStatisticsResponseData = {
  statistics: StatisticsPayload;
  relapses: RelapsePayload[];
  hourly_relapse_distribution: RelapseHourStatPayload[];
  relapse_triggers_distribution: RelapseTriggerStatPayload[];
  peak_relapse_hours_utc: number[];
  peak_relapse_count: number;
  ai_summary: string;
  relapse_time_summary: RelapseTimeSummaryPayload;
  relapse_trigger_summary: RelapseSolutionPayload | null;
};

// ── Helpers ──

function previousLocalDate(localDate: string) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dayNameFromLocalDate(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  return INDONESIAN_DAY_NAMES[date.getUTCDay()];
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return roundRatio(numerator / denominator);
}

function zeroProgressPayload(windowDays: number): ProgressPayload {
  return { window_days: windowDays, current_successful_checkins: 0, previous_successful_checkins: 0, delta: 0, delta_rate: 0 };
}

// ── Payload mappers ──

function mapCheckInPayload(row: CheckInRecord): CheckInPayload {
  return {
    id: row.id,
    user_id: row.userId,
    check_in_date: row.localDate,
    check_in_day_name: dayNameFromLocalDate(row.localDate),
    mood: row.mood,
    is_successful: row.isSuccessful,
    commitment: row.commitment,
    relapse_trigger: [],
    created_at: row.createdAt,
  };
}

function mapRelapsePayload(row: RelapseRecord): RelapsePayload {
  return {
    id: row.id,
    user_id: row.userId,
    relapse_date: row.localDate,
    relapse_day_name: dayNameFromLocalDate(row.localDate),
    mood: row.mood,
    commitment: row.commitment,
    relapse_trigger: row.triggers,
    check_in_id: row.checkInId,
    created_at: row.createdAt,
  };
}

// ── Streak computation ──

function computeStreaks(successDates: string[], todayLocalDate: string): { current: number; longest: number } {
  if (successDates.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let currentRun = 1;
  for (let i = 1; i < successDates.length; i++) {
    const prev = successDates[i - 1];
    const curr = successDates[i];
    if (curr === nextLocalDate(prev)) {
      currentRun++;
    } else {
      if (currentRun > longest) longest = currentRun;
      currentRun = 1;
    }
  }
  if (currentRun > longest) longest = currentRun;

  // Current streak: count backwards from latest
  const latest = successDates[successDates.length - 1];
  const yesterday = previousLocalDate(todayLocalDate);
  if (latest < yesterday) return { current: 0, longest };

  let current = 1;
  for (let i = successDates.length - 1; i > 0; i--) {
    if (successDates[i - 1] === previousLocalDate(successDates[i])) {
      current++;
    } else {
      break;
    }
  }
  return { current, longest };
}

function nextLocalDate(localDate: string) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// ── Statistics computation ──

function computeStatistics(
  checkIns: CheckInRecord[],
  relapses: RelapseRecord[],
  todayLocalDate: string,
  pornFreeGoal: number | null,
): StatisticsPayload {
  if (checkIns.length === 0 && relapses.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      total_checkins: 0,
      total_attempts: 0,
      success_rate: 0,
      streak_calendar: [],
      relapse_calendar: [],
      relapse_count: 0,
      relapse_rate: 0,
      recovery_success_rate: 0,
      checkin_consistency_score: 0,
      weekly_progress: zeroProgressPayload(7),
      monthly_progress: zeroProgressPayload(30),
      mood_trend: [],
      last_check_in_date: null,
      last_check_in_day_name: null,
      last_relapse_date: null,
      last_relapse_day_name: null,
      weekday_summary: buildWeekdaySummary([], []),
      streak_goal_comparison: buildStreakGoalComparison(pornFreeGoal, 0, 0),
    };
  }

  const relapseDaySet = new Set<string>();
  const legacyRelapseDaySet = new Set<string>();
  const activeDaySet = new Set<string>();
  const moodByDay = new Map<string, Map<string, number>>();
  const successCountByDay = new Map<string, number>();
  const totalCountByDay = new Map<string, number>();
  let lastCheckInDate: string | null = null;
  let lastRelapseDate: string | null = null;

  for (const row of checkIns) {
    const day = row.localDate;
    activeDaySet.add(day);
    totalCountByDay.set(day, (totalCountByDay.get(day) ?? 0) + 1);
    if (lastCheckInDate === null || day > lastCheckInDate) lastCheckInDate = day;

    const moodMap = moodByDay.get(day) ?? new Map();
    const moodKey = row.mood.trim().toLowerCase() || "unknown";
    moodMap.set(moodKey, (moodMap.get(moodKey) ?? 0) + 1);
    moodByDay.set(day, moodMap);

    if (!row.isSuccessful) {
      legacyRelapseDaySet.add(day);
      relapseDaySet.add(day);
      if (lastRelapseDate === null || day > lastRelapseDate) lastRelapseDate = day;
    }
  }

  for (const row of relapses) {
    const day = row.localDate;
    activeDaySet.add(day);
    if (lastRelapseDate === null || day > lastRelapseDate) lastRelapseDate = day;

    if (legacyRelapseDaySet.has(day)) continue;
    relapseDaySet.add(day);
    totalCountByDay.set(day, (totalCountByDay.get(day) ?? 0) + 1);

    const moodMap = moodByDay.get(day) ?? new Map();
    const moodKey = row.mood.trim().toLowerCase() || "unknown";
    moodMap.set(moodKey, (moodMap.get(moodKey) ?? 0) + 1);
    moodByDay.set(day, moodMap);
  }

  let successCount = 0;
  const successDates: string[] = [];
  const calendarDaySet = new Set<string>();

  for (const row of checkIns) {
    if (!row.isSuccessful) continue;
    const day = row.localDate;
    if (relapseDaySet.has(day)) continue;
    successCount++;
    successCountByDay.set(day, (successCountByDay.get(day) ?? 0) + 1);
    successDates.push(day);
    calendarDaySet.add(day);
  }

  const calendar = [...calendarDaySet].sort();
  const relapseCalendar = [...relapseDaySet].sort();

  const relapseCount = relapseDaySet.size;
  const totalAttempts = successCount + relapseCount;
  const recoverySuccessRate = safeRatio(successCount, totalAttempts);
  const relapseRate = safeRatio(relapseCount, totalAttempts);
  const successRate = safeRatio(successCount, totalAttempts);

  const { current: currentStreak, longest: longestStreak } = computeStreaks(successDates, todayLocalDate);
  const effectiveCurrentStreak = relapseDaySet.has(todayLocalDate) ? 0 : currentStreak;
  const consistencyScore = safeRatio(activeDaySet.size, 30);
  const weeklyProgress = computeProgressPayload(checkIns, todayLocalDate, 7);
  const monthlyProgress = computeProgressPayload(checkIns, todayLocalDate, 30);
  const moodTrend = buildMoodTrendPayload(moodByDay, successCountByDay, totalCountByDay);
  const weekdaySummary = buildWeekdaySummary(checkIns, relapses);

  return {
    current_streak: effectiveCurrentStreak,
    longest_streak: longestStreak,
    total_checkins: successCount,
    total_attempts: totalAttempts,
    success_rate: successRate,
    streak_calendar: calendar,
    relapse_calendar: relapseCalendar,
    relapse_count: relapseCount,
    relapse_rate: relapseRate,
    recovery_success_rate: recoverySuccessRate,
    checkin_consistency_score: consistencyScore,
    weekly_progress: weeklyProgress,
    monthly_progress: monthlyProgress,
    mood_trend: moodTrend,
    last_check_in_date: lastCheckInDate,
    last_check_in_day_name: lastCheckInDate ? dayNameFromLocalDate(lastCheckInDate) : null,
    last_relapse_date: lastRelapseDate,
    last_relapse_day_name: lastRelapseDate ? dayNameFromLocalDate(lastRelapseDate) : null,
    weekday_summary: weekdaySummary,
    streak_goal_comparison: buildStreakGoalComparison(pornFreeGoal, effectiveCurrentStreak, longestStreak),
  };
}

function computeProgressPayload(checkIns: CheckInRecord[], todayLocalDate: string, windowDays: number): ProgressPayload {
  const endDate = todayLocalDate;
  const currentStart = offsetLocalDate(endDate, -(windowDays - 1));
  const previousEnd = offsetLocalDate(currentStart, -1);
  const previousStart = offsetLocalDate(previousEnd, -(windowDays - 1));

  const currentSuccess = countSuccessfulCheckInsInRange(checkIns, currentStart, endDate);
  const previousSuccess = countSuccessfulCheckInsInRange(checkIns, previousStart, previousEnd);
  const delta = currentSuccess - previousSuccess;
  const deltaRate = previousSuccess > 0 ? roundRatio(delta / previousSuccess) : 0;

  return { window_days: windowDays, current_successful_checkins: currentSuccess, previous_successful_checkins: previousSuccess, delta, delta_rate: deltaRate };
}

function offsetLocalDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function countSuccessfulCheckInsInRange(checkIns: CheckInRecord[], start: string, end: string): number {
  let count = 0;
  for (const row of checkIns) {
    if (!row.isSuccessful) continue;
    if (row.localDate >= start && row.localDate <= end) count++;
  }
  return count;
}

function buildMoodTrendPayload(
  moodByDay: Map<string, Map<string, number>>,
  successByDay: Map<string, number>,
  totalByDay: Map<string, number>,
): MoodTrendPayload[] {
  const days = [...moodByDay.keys()].sort();
  return days.map((day) => {
    const moodMap = moodByDay.get(day)!;
    let dominant = "unknown";
    let maxCount = -1;
    for (const [mood, cnt] of moodMap) {
      if (cnt > maxCount) { dominant = mood; maxCount = cnt; }
    }
    return {
      date: day,
      day_name: dayNameFromLocalDate(day),
      dominant_mood: dominant,
      successful_ratio: safeRatio(successByDay.get(day) ?? 0, totalByDay.get(day) ?? 0),
    };
  });
}

function buildWeekdaySummary(checkIns: CheckInRecord[], relapses: RelapseRecord[]): WeekdaySummaryPayload[] {
  type DayCounter = { success: number; relapse: number; total: number };
  const counters = new Map<number, DayCounter>();
  const legacyRelapseDays = new Set<string>();

  for (const row of checkIns) {
    const dayIdx = new Date(`${row.localDate}T00:00:00.000Z`).getUTCDay();
    const c = counters.get(dayIdx) ?? { success: 0, relapse: 0, total: 0 };
    c.total++;
    if (row.isSuccessful) {
      c.success++;
    } else {
      c.relapse++;
      legacyRelapseDays.add(row.localDate);
    }
    counters.set(dayIdx, c);
  }

  for (const row of relapses) {
    if (legacyRelapseDays.has(row.localDate)) continue;
    const dayIdx = new Date(`${row.localDate}T00:00:00.000Z`).getUTCDay();
    const c = counters.get(dayIdx) ?? { success: 0, relapse: 0, total: 0 };
    c.total++;
    c.relapse++;
    counters.set(dayIdx, c);
  }

  // Monday(1)..Sunday(0) → Senin..Minggu
  const ordered = [1, 2, 3, 4, 5, 6, 0];
  return ordered.map((dayIdx) => {
    const c = counters.get(dayIdx) ?? { success: 0, relapse: 0, total: 0 };
    return {
      day_name: INDONESIAN_DAY_NAMES[dayIdx],
      successful_checkins: c.success,
      relapse_count: c.relapse,
      total_checkins: c.total,
      success_rate: safeRatio(c.success, c.total),
    };
  });
}

function buildStreakGoalComparison(pornFreeGoal: number | null, currentStreak: number, longestStreak: number): StreakGoalComparisonPayload {
  if (pornFreeGoal === null || pornFreeGoal <= 0) {
    return { porn_free_goal: null, current_streak: currentStreak, longest_streak: longestStreak, goal_reached: false, remaining_days: null, progress_rate: 0 };
  }
  const goal = pornFreeGoal;
  const reached = currentStreak >= goal;
  const remaining = reached ? 0 : goal - currentStreak;
  const rate = reached ? 1 : roundRatio(currentStreak / goal);
  return { porn_free_goal: goal, current_streak: currentStreak, longest_streak: longestStreak, goal_reached: reached, remaining_days: remaining, progress_rate: rate };
}

// ── Relapse statistics ──

function computeRelapseHourStats(relapses: RelapseRecord[]): { distribution: RelapseHourStatPayload[]; peakHours: number[]; peakCount: number } {
  if (relapses.length === 0) return { distribution: [], peakHours: [], peakCount: 0 };

  const countByHour = new Array(24).fill(0);
  for (const row of relapses) {
    const hour = new Date(row.createdAt).getUTCHours();
    if (hour >= 0 && hour < 24) countByHour[hour]++;
  }

  let peakCount = 0;
  for (let h = 0; h < 24; h++) {
    if (countByHour[h] > peakCount) peakCount = countByHour[h];
  }

  const distribution: RelapseHourStatPayload[] = [];
  const peakHours: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (countByHour[h] <= 0) continue;
    distribution.push({ hour_utc: h, relapse_count: countByHour[h] });
    if (countByHour[h] === peakCount) peakHours.push(h);
  }

  return { distribution, peakHours, peakCount };
}

function computeRelapseTriggerStats(relapses: RelapseRecord[]): RelapseTriggerStatPayload[] {
  if (relapses.length === 0) return [];

  const countByTrigger = new Map<string, { label: string; count: number }>();
  for (const row of relapses) {
    for (const trigger of row.triggers) {
      const label = trigger.trim();
      if (label === "") continue;
      const key = label.toLowerCase();
      const entry = countByTrigger.get(key);
      if (entry) {
        entry.count++;
      } else {
        countByTrigger.set(key, { label, count: 1 });
      }
    }
  }

  return [...countByTrigger.values()].sort((a, b) => b.count - a.count).map((e) => ({
    relapse_trigger: e.label,
    relapse_trigger_count: e.count,
  }));
}

// ── Relapse solution (deterministic fallback when AI unavailable) ──

function buildFallbackRelapseSolution(mood: string, triggers: string[], now: Date): RelapseSolutionPayload {
  const triggerText = triggers.join(", ").trim() || "no triggers recorded";
  return {
    title: "Quick Recovery Steps",
    analysis: `Relapse detected with mood ${mood.trim().toLowerCase()}. Current trigger pattern: ${triggerText}.`,
    summary: "Best immediate action: cut off access to the trigger now, stabilize your emotions briefly, then switch to a pre-planned safe activity.",
    generated_at: now.toISOString(),
  };
}

function buildRelapseTimeSummary(relapses: RelapseRecord[], peakHours: number[], peakCount: number, now: Date): RelapseTimeSummaryPayload {
  if (peakHours.length === 0) {
    return {
      title: "Relapse Pattern Not Yet Available",
      analysis: "Not enough relapse data to analyze patterns yet.",
      summary: "Best immediate action: start recording triggers consistently so pattern analysis and prevention strategies can be personalized.",
      generated_at: now.toISOString(),
    };
  }

  const formattedHours = peakHours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ");
  const peakLine = `most frequent relapse hours (UTC): ${formattedHours} (${peakCount} occurrences)`;

  const triggerStats = computeRelapseTriggerStats(relapses);
  const topTrigger = triggerStats.length > 0 ? triggerStats[0] : null;
  const topLine = topTrigger ? `Most frequent trigger: ${topTrigger.relapse_trigger}. ` : "";

  return {
    title: "Relapse Time Analysis",
    analysis: `Relapse pattern shows peak at UTC hours: ${formattedHours}. ${peakLine}.`,
    summary: `${topLine}Best immediate action: cut off access to the trigger now, stabilize your emotions briefly, then switch to a pre-planned safe activity.`,
    generated_at: now.toISOString(),
  };
}

function formatHourUTC(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// ── Activity summary ──

function computeActivitySummary(
  windowDays: number,
  checkIns: CheckInRecord[],
  relapses: RelapseRecord[],
): ActivitySummaryPayload {
  const activityItems: Array<{ date: string; dayName: string; type: string; mood?: string; ts: Date }> = [];
  const activeDaySet = new Set<string>();
  let successfulCheckins = 0;
  let relapseCount = 0;

  for (const row of checkIns) {
    activeDaySet.add(row.localDate);
    const type = row.isSuccessful ? "checkin_success" : "checkin_relapse";
    if (row.isSuccessful) successfulCheckins++;
    else relapseCount++;

    activityItems.push({
      date: row.localDate,
      dayName: dayNameFromLocalDate(row.localDate),
      type,
      mood: row.mood.trim() || undefined,
      ts: new Date(row.createdAt),
    });
  }

  for (const row of relapses) {
    activeDaySet.add(row.localDate);
    relapseCount++;
    activityItems.push({
      date: row.localDate,
      dayName: dayNameFromLocalDate(row.localDate),
      type: "relapse",
      mood: row.mood.trim() || undefined,
      ts: new Date(row.createdAt),
    });
  }

  activityItems.sort((a, b) => b.ts.getTime() - a.ts.getTime());

  return {
    window_days: windowDays,
    successful_checkins: successfulCheckins,
    relapses: relapseCount,
    active_days: activeDaySet.size,
    recent_activity: activityItems.map((item) => {
      const result: ActivityItemPayload = { date: item.date, day_name: item.dayName, type: item.type };
      if (item.mood) result.mood = item.mood;
      return result;
    }),
  };
}

// ── Service ──

export function createRoutineService(repository: RoutineRepository, advisor?: AiProvider) {
  const RELAPSE_SOLUTION_SYSTEM_PROMPT = buildSafetySystemPrompt({ mode: "relapse_solution", crisis: false });

  async function buildRelapseSolution(userId: string, mood: string, commitment: string | null, triggers: string[]): Promise<RelapseSolutionPayload> {
    const now = new Date();
    if (!advisor) return buildFallbackRelapseSolution(mood, triggers, now);

    const triggerText = triggers.join(", ").trim() || "no triggers recorded";
    const contextParts = [`Mood: ${mood}`, `Triggers: ${triggerText}`];
    if (commitment) contextParts.push(`Notes: ${commitment}`);
    const userPrompt = contextParts.join(". ");

    if (hasCrisisSignal(userPrompt)) {
      return {
        title: "Safety First",
        analysis: "Your message indicates you may need immediate support.",
        summary: CRISIS_ESCALATION_COPY,
        generated_at: now.toISOString(),
      };
    }

    try {
      const response = await advisor.complete({
        messages: [
          { role: "system", content: RELAPSE_SOLUTION_SYSTEM_PROMPT },
          { role: "user", content: `The user just recorded a relapse. Help them with a supportive, non-diagnostic recovery plan.\n\n${userPrompt}\n\nRespond with:\n1. A short encouraging title\n2. A brief analysis of the situation (do NOT diagnose)\n3. A practical summary of next steps (max 3 actions)` },
        ],
      });

      const lines = response.content.split("\n").filter(Boolean);
      const title = lines[0]?.replace(/^#+\s*/, "").trim() || "Recovery Support";
      const analysis = lines.slice(1, 3).join(" ").trim() || `Relapse recorded with mood ${mood}.`;
      const summary = lines.slice(3).join(" ").trim() || "Take a moment to breathe, identify your triggers, and reach out to your support system.";

      return { title, analysis, summary, generated_at: now.toISOString() };
    } catch {
      return buildFallbackRelapseSolution(mood, triggers, now);
    }
  }
  return {
    async createCheckIn(userId: string, input: CheckInInput): Promise<CheckInResponseData> {
      const localDate = input.localDate ?? getJakartaLocalDate();

      if (await repository.findCheckInByUserAndDate(userId, localDate)) {
        throw new AppError(AppErrorCode.Conflict, "You have already checked in for this date.");
      }

      const result = await repository.transaction(async (tx) => {
        const checkIn = await tx.createCheckIn({
          userId,
          mood: input.mood,
          isSuccessful: input.isSuccessful,
          commitment: input.commitment,
          localDate,
        });

        // Sync streak
        await syncStreak(tx, userId, localDate, true);
        return checkIn;
      });

      const [allCheckIns, allRelapses, user] = await Promise.all([
        repository.listCheckInsByUser(userId),
        repository.listRelapses(userId),
        repository.findUserById(userId),
      ]);

      const statistics = computeStatistics(allCheckIns, allRelapses, getJakartaLocalDate(), user?.pornFreeGoal ?? null);

      return {
        check_in: mapCheckInPayload(result),
        statistics,
        relapse_solution: null,
      };
    },

    async createRelapse(userId: string, input: RelapseInput): Promise<RelapseResponseData> {
      const localDate = input.localDate ?? getJakartaLocalDate();

      const existing = await repository.findRelapseByUserAndDate(userId, localDate);
      if (existing) {
        throw new AppError(AppErrorCode.Conflict, "You have already recorded a relapse for this date.");
      }

      const result = await repository.transaction(async (tx) => {
        // Find same-day check-in to link
        const sameDayCheckIn = await tx.findCheckInByUserAndDate(userId, localDate);

        const relapse = await tx.createRelapse({
          userId,
          mood: input.mood,
          triggers: input.triggers,
          commitment: input.commitment,
          checkInId: sameDayCheckIn?.id ?? null,
          localDate,
        });

        // Reset streak
        const current = await tx.findStreakByUserId(userId);
        await tx.upsertStreak({
          userId,
          currentStreak: 0,
          longestStreak: current?.longestStreak ?? 0,
          lastCheckInLocalDate: current?.lastCheckInLocalDate ?? null,
          lastRelapseLocalDate: localDate,
        });

        return relapse;
      });

      const [allCheckIns, allRelapses, user] = await Promise.all([
        repository.listCheckInsByUser(userId),
        repository.listRelapses(userId),
        repository.findUserById(userId),
      ]);

      const statistics = computeStatistics(allCheckIns, allRelapses, getJakartaLocalDate(), user?.pornFreeGoal ?? null);
      const solution = await buildRelapseSolution(userId, input.mood, input.commitment, input.triggers);

      return {
        relapse: mapRelapsePayload(result),
        statistics,
        relapse_solution: solution,
      };
    },

    async getStatistics(userId: string): Promise<StatisticsPayload> {
      const [checkIns, relapses, user] = await Promise.all([
        repository.listCheckInsByUser(userId),
        repository.listRelapses(userId),
        repository.findUserById(userId),
      ]);
      return computeStatistics(checkIns, relapses, getJakartaLocalDate(), user?.pornFreeGoal ?? null);
    },

    async getActivitySummary(userId: string, windowDays: number): Promise<ActivitySummaryPayload> {
      const today = getJakartaLocalDate();
      const startDate = offsetLocalDate(today, -(windowDays - 1));

      const [checkIns, relapses] = await Promise.all([
        repository.listCheckInsByUserWithinDateRange(userId, startDate, today),
        repository.listRelapsesByUserWithinDateRange(userId, startDate, today),
      ]);

      return computeActivitySummary(windowDays, checkIns, relapses);
    },

    async listRelapses(userId: string): Promise<RelapsePayload[]> {
      const rows = await repository.listRelapses(userId);
      return rows.map(mapRelapsePayload);
    },

    async getRelapseStatistics(userId: string): Promise<RelapseStatisticsResponseData> {
      const [checkIns, relapses, user] = await Promise.all([
        repository.listCheckInsByUser(userId),
        repository.listRelapses(userId),
        repository.findUserById(userId),
      ]);

      const statistics = computeStatistics(checkIns, relapses, getJakartaLocalDate(), user?.pornFreeGoal ?? null);
      const now = new Date();

      const { distribution: hourlyDistribution, peakHours, peakCount } = computeRelapseHourStats(relapses);
      const triggerDistribution = computeRelapseTriggerStats(relapses);
      const relapseTimeSummary = buildRelapseTimeSummary(relapses, peakHours, peakCount, now);

      let relapseTriggerSummary: RelapseSolutionPayload | null = null;
      if (relapses.length > 0) {
        const latest = relapses.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
        relapseTriggerSummary = await buildRelapseSolution(userId, latest.mood, latest.commitment, latest.triggers);
      }

      return {
        statistics,
        relapses: relapses.map(mapRelapsePayload),
        hourly_relapse_distribution: hourlyDistribution,
        relapse_triggers_distribution: triggerDistribution,
        peak_relapse_hours_utc: peakHours,
        peak_relapse_count: peakCount,
        ai_summary: "New insights for you will be available soon. Keep writing your daily journal!",
        relapse_time_summary: relapseTimeSummary,
        relapse_trigger_summary: relapseTriggerSummary,
      };
    },
  };
}

async function syncStreak(repository: RoutineRepository, userId: string, localDate: string, isSuccessful: boolean): Promise<void> {
  const current = await repository.findStreakByUserId(userId);

  if (!isSuccessful) {
    await repository.upsertStreak({
      userId,
      currentStreak: 0,
      longestStreak: current?.longestStreak ?? 0,
      lastCheckInLocalDate: current?.lastCheckInLocalDate ?? null,
      lastRelapseLocalDate: localDate,
    });
    return;
  }

  // Check if relapse exists on same day
  const sameDayRelapse = await repository.findRelapseByUserAndDate(userId, localDate);
  if (sameDayRelapse) {
    await repository.upsertStreak({
      userId,
      currentStreak: 0,
      longestStreak: current?.longestStreak ?? 0,
      lastCheckInLocalDate: localDate,
      lastRelapseLocalDate: localDate,
    });
    return;
  }

  // Consecutive check-in logic
  const newStreak = current?.lastCheckInLocalDate === previousLocalDate(localDate)
    ? (current.currentStreak + 1)
    : 1;

  await repository.upsertStreak({
    userId,
    currentStreak: newStreak,
    longestStreak: Math.max(current?.longestStreak ?? 0, newStreak),
    lastCheckInLocalDate: localDate,
    lastRelapseLocalDate: current?.lastRelapseLocalDate ?? null,
  });
}

export type RoutineService = ReturnType<typeof createRoutineService>;
