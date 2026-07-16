import type { Context, Next } from "hono";
import { AppError, AppErrorCode } from "../../shared/errors";
import type { AppConfig } from "../../shared/config";
import { verifyAccessToken } from "./token";
import type { AuthService } from "./auth.service";

export type AuthVariables = {
  requestId: string;
  auth: {
    user: Awaited<ReturnType<AuthService["findCurrentUser"]>>;
  };
};

export function parseBearerToken(header: string | undefined) {
  if (!header) {
    throw new AppError(AppErrorCode.Unauthenticated, "Bearer token is required.");
  }

  const [scheme, token, extra] = header.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) {
    throw new AppError(AppErrorCode.Unauthenticated, "Bearer token is required.");
  }

  return token;
}

export function authGuard(input: { service: AuthService; config: AppConfig }) {
  return async (context: Context<{ Variables: AuthVariables }>, next: Next) => {
    const token = parseBearerToken(context.req.header("Authorization"));
    const payload = await verifyAccessToken({ token, secret: input.config.security.jwtAccessSecret });
    const user = await input.service.findCurrentUser(payload.sub);

    context.set("auth", { user });
    await next();
  };
}
