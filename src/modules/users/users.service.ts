import { AppError, AppErrorCode } from "../../shared/errors";
import type { UsersRepository, UserSettingsUpdate, OnboardingUpdate } from "./users.repository";

export type UserProfilePayload = {
  id: string;
  email: string;
  nickname: string | null;
  recovery_reason: string | null;
  daily_checkin_time: string | null;
  porn_free_goal: number | null;
  onboarding_completed: boolean;
};

export type OnboardingAnalysisPayload = {
  level: string;
  title: string;
  level_description: string;
  pattern_analysis: string;
  encouragement: string;
};

export type OnboardingCompletionPayload = UserProfilePayload & {
  onboarding_analysis: OnboardingAnalysisPayload | null;
};

export type AiAnalyzer = {
  analyzeOnboarding(input: {
    recovery_reason: string;
    porn_free_goal: number;
    answers: Record<string, unknown>;
    dependency_level: string | null;
  }): Promise<OnboardingAnalysisPayload>;
};

function toProfilePayload(record: {
  id: string | null;
  userId: string;
  email: string;
  nickname: string | null;
  recoveryReason: string | null;
  dailyCheckinTime: string | null;
  pornFreeGoal: number | null;
  onboardingCompletedAt: Date | null;
}): UserProfilePayload {
  return {
    id: record.userId,
    email: record.email,
    nickname: record.nickname,
    recovery_reason: record.recoveryReason,
    daily_checkin_time: record.dailyCheckinTime,
    porn_free_goal: record.pornFreeGoal,
    onboarding_completed: record.onboardingCompletedAt !== null,
  };
}

export function createUsersService(repository: UsersRepository, aiAnalyzer?: AiAnalyzer) {
  return {
    async getCurrentProfile(userId: string) {
      const profile = await repository.findCurrentUser(userId);
      if (!profile) {
        throw new AppError(AppErrorCode.NotFound, "User profile was not found.");
      }
      return toProfilePayload(profile);
    },
    async updateSettings(userId: string, input: UserSettingsUpdate) {
      const updated = await repository.updateSettings(userId, input);
      return toProfilePayload(updated);
    },
    async completeOnboarding(userId: string, input: OnboardingUpdate & {
      nickname: string;
      recovery_reason: string;
      daily_checkin_time: string;
      porn_free_goal: number;
      answers?: Record<string, unknown>;
      dependency_level?: string | null;
    }): Promise<OnboardingCompletionPayload> {
      const existing = await repository.findCurrentUser(userId);
      if (!existing) {
        throw new AppError(AppErrorCode.NotFound, "User profile was not found.");
      }

      if (existing.onboardingCompletedAt) {
        const sameNickname = existing.nickname === input.nickname;
        const sameRecoveryReason = existing.recoveryReason === input.recovery_reason;
        const sameCheckInTime = existing.dailyCheckinTime === input.daily_checkin_time;
        const samePornFreeGoal = existing.pornFreeGoal === input.porn_free_goal;

        if (sameNickname && sameRecoveryReason && sameCheckInTime && samePornFreeGoal) {
          const profile = toProfilePayload(existing);
          return {
            ...profile,
            onboarding_analysis: existing.aiSummary ? parseAiSummary(existing.aiSummary) : null,
          };
        }

        throw new AppError(AppErrorCode.Conflict, "Onboarding already completed with different data.", [
          "Onboarding has already been completed. Submit new request to update settings instead.",
        ]);
      }

      let aiSummary: string | null = null;
      let onboardingAnalysis: OnboardingAnalysisPayload | null = null;

      if (aiAnalyzer) {
        try {
          onboardingAnalysis = await aiAnalyzer.analyzeOnboarding({
            recovery_reason: input.recovery_reason,
            porn_free_goal: input.porn_free_goal,
            answers: input.answers ?? {},
            dependency_level: input.dependency_level ?? null,
          });
          aiSummary = `${onboardingAnalysis.title}: ${onboardingAnalysis.level_description} | ${onboardingAnalysis.pattern_analysis} | ${onboardingAnalysis.encouragement}`;
        } catch {
          aiSummary = null;
          onboardingAnalysis = null;
        }
      }

      const updated = await repository.completeOnboarding(userId, {
        ...input,
        ai_summary: aiSummary,
      });

      const profile = toProfilePayload(updated);

      return {
        ...profile,
        onboarding_analysis: onboardingAnalysis,
      };
    },
  };
}

function parseAiSummary(summary: string): OnboardingAnalysisPayload {
  const parts = summary.split(" | ");
  const [titleAndLevel, patternAnalysis, encouragement] = parts;
  const titleParts = (titleAndLevel ?? "").split(": ");

  return {
    level: "Moderate",
    title: titleParts[1]?.trim() ?? titleParts[0]?.trim() ?? "Recovery Support Summary",
    level_description: titleParts[0]?.trim() ?? "",
    pattern_analysis: patternAnalysis?.trim() ?? "",
    encouragement: encouragement?.trim() ?? "",
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
