import { AppError, AppErrorCode } from "../../shared/errors";
import type { UsersRepository, UserSettingsUpdate } from "./users.repository";

export function createUsersService(repository: UsersRepository) {
  return {
    async getCurrentProfile(userId: string) {
      const profile = await repository.findCurrentUser(userId);
      if (!profile) {
        throw new AppError(AppErrorCode.NotFound, "User profile was not found.");
      }
      return profile;
    },
    async updateSettings(userId: string, input: UserSettingsUpdate) {
      return repository.updateSettings(userId, input);
    },
    async completeOnboarding(userId: string, input: UserSettingsUpdate) {
      return repository.completeOnboarding(userId, input);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
