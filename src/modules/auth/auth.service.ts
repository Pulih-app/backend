import { AppError, AppErrorCode } from "../../shared/errors";
import type { AppConfig } from "../../shared/config";
import type { AuthRepository, AuthUserRecord } from "./auth.repository";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import { issueAccessToken } from "./token";
import type { AuthUser } from "./auth.types";

export type AuthResult = {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
};

function toPublicUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export function createAuthService(repository: AuthRepository, config: AppConfig) {
  async function buildResult(user: AuthUserRecord): Promise<AuthResult> {
    const publicUser = toPublicUser(user);
    return {
      accessToken: await issueAccessToken({
        user: publicUser,
        secret: config.security.jwtAccessSecret,
        ttlSeconds: config.security.jwtAccessTtlSeconds,
      }),
      tokenType: "Bearer",
      expiresIn: config.security.jwtAccessTtlSeconds,
      user: publicUser,
    };
  }

  return {
    async register(input: { email: string; password: string }) {
      validatePassword(input.password);

      const existing = await repository.findByEmail(input.email);
      if (existing) {
        throw new AppError(AppErrorCode.Conflict, "Email is already registered.", ["email: Email is already registered."]);
      }

      const passwordHash = await hashPassword(input.password, config.security.passwordHashCost);
      const user = await repository.createPatient({ email: input.email, passwordHash });
      return buildResult(user);
    },
    async login(input: { email: string; password: string }) {
      const user = await repository.findByEmail(input.email);
      const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;

      if (!user || !valid) {
        throw new AppError(AppErrorCode.Unauthenticated, "Invalid email or password.");
      }

      return buildResult(user);
    },
    async findCurrentUser(id: string) {
      const user = await repository.findById(id);
      if (!user) {
        throw new AppError(AppErrorCode.Unauthenticated, "Authenticated user was not found.");
      }
      return toPublicUser(user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
