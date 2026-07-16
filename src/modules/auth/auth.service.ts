import { AppError, AppErrorCode } from "../../shared/errors";
import type { AppConfig } from "../../shared/config";
import type { AuthRepository, AuthUserRecord } from "./auth.repository";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import { issueAccessToken } from "./token";
import type { AuthUser, AuthResult, UserPayload } from "./auth.types";

export { type AuthResult, type AuthUser };

function toAuthUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
  };
}

export function createAuthService(repository: AuthRepository, config: AppConfig) {
  async function buildResult(user: AuthUserRecord): Promise<AuthResult> {
    const publicUser = toAuthUser(user);
    const userPayload: UserPayload = {
      id: publicUser.id,
      email: publicUser.email,
      nickname: null,
      recovery_reason: null,
      daily_checkin_time: null,
      porn_free_goal: null,
      onboarding_completed: false,
    };

    return {
      user: userPayload,
      session: {
        access_token: await issueAccessToken({
          user: publicUser,
          secret: config.security.jwtAccessSecret,
          ttlSeconds: config.security.jwtAccessTtlSeconds,
        }),
        token_type: "Bearer",
        expires_in: config.security.jwtAccessTtlSeconds,
      },
    };
  }

  return {
    async register(input: { email: string; username: string; password: string; confirm_password: string }) {
      validatePassword(input.password);

      if (input.password !== input.confirm_password) {
        throw new AppError(AppErrorCode.ValidationError, "Password validation failed.", [
          "confirm_password: Passwords do not match.",
        ]);
      }

      const existingEmail = await repository.findByEmail(input.email);
      if (existingEmail) {
        throw new AppError(AppErrorCode.Conflict, "Email is already registered.", ["email: Email is already registered."]);
      }

      const existingUsername = await repository.findByUsername(input.username);
      if (existingUsername) {
        throw new AppError(AppErrorCode.Conflict, "Username is already taken.", ["username: Username is already taken."]);
      }

      const passwordHash = await hashPassword(input.password, config.security.passwordHashCost);
      const user = await repository.createPatient({
        email: input.email,
        username: input.username,
        passwordHash,
      });

      return buildResult(user);
    },
    async login(input: { identifier: string; password: string }) {
      const user = await repository.findByLoginIdentifier(input.identifier);
      const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;

      if (!user || !valid) {
        throw new AppError(AppErrorCode.Unauthenticated, "Invalid identifier or password.");
      }

      return buildResult(user);
    },
    async findCurrentUser(id: string) {
      const user = await repository.findById(id);
      if (!user) {
        throw new AppError(AppErrorCode.Unauthenticated, "Authenticated user was not found.");
      }
      return toAuthUser(user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
