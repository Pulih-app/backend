import { AppError, AppErrorCode } from "../../shared/errors";
import type { CheckInInput, RelapseInput } from "./routine.schema";
import type { RoutineRepository } from "./routine.repository";

const JAKARTA_TIMEZONE = "Asia/Jakarta";

export function getJakartaLocalDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JAKARTA_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function previousLocalDate(localDate: string) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function computeStreak(current: { currentStreak: number; longestStreak: number; lastCheckInLocalDate: string | null } | null, localDate: string) {
  const currentStreak = current?.lastCheckInLocalDate === previousLocalDate(localDate) ? current.currentStreak + 1 : 1;
  return { currentStreak, longestStreak: Math.max(current?.longestStreak ?? 0, currentStreak) };
}

export function createRoutineService(repository: RoutineRepository) {
  return {
    async createCheckIn(userId: string, input: CheckInInput) {
      const localDate = input.localDate ?? getJakartaLocalDate();
      if (await repository.findCheckInByUserAndDate(userId, localDate)) {
        throw new AppError(AppErrorCode.Conflict, "You have already checked in for this date.");
      }
      return repository.transaction(async (tx) => {
        const checkIn = await tx.createCheckIn({ userId, mood: input.mood, note: input.note, localDate });
        const current = await tx.findStreakByUserId(userId);
        const streak = computeStreak(current, localDate);
        await tx.upsertStreak({ userId, currentStreak: streak.currentStreak, longestStreak: streak.longestStreak, lastCheckInLocalDate: localDate, lastRelapseLocalDate: current?.lastRelapseLocalDate ?? null });
        return { checkIn, streak: await tx.findStreakByUserId(userId) };
      });
    },
    async createRelapse(userId: string, input: RelapseInput) {
      const localDate = input.localDate ?? getJakartaLocalDate();
      return repository.transaction(async (tx) => {
        const relapse = await tx.createRelapse({ userId, mood: input.mood, triggers: input.triggers, note: input.note, localDate });
        const current = await tx.findStreakByUserId(userId);
        await tx.upsertStreak({ userId, currentStreak: 0, longestStreak: current?.longestStreak ?? 0, lastCheckInLocalDate: current?.lastCheckInLocalDate ?? null, lastRelapseLocalDate: localDate });
        return { relapse, streak: await tx.findStreakByUserId(userId) };
      });
    },
    async getStatistics(userId: string) {
      const [summary, streak] = await Promise.all([repository.getSummary(userId), repository.findStreakByUserId(userId)]);
      return { ...summary, currentStreak: streak?.currentStreak ?? 0, longestStreak: streak?.longestStreak ?? 0, lastCheckInLocalDate: streak?.lastCheckInLocalDate ?? null, lastRelapseLocalDate: streak?.lastRelapseLocalDate ?? null };
    },
    async getActivitySummary(userId: string) {
      return repository.getActivitySummary(userId, 30);
    },
    async listRelapses(userId: string) {
      return repository.listRelapses(userId);
    },
    async getRelapseStatistics(userId: string) {
      return repository.getRelapseStatistics(userId);
    },
  };
}

export type RoutineService = ReturnType<typeof createRoutineService>;
