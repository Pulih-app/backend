import type { Context, Next } from "hono";
import { AppError } from "../errors";

export type RequestBaselineConfig = {
  allowedOrigins: string[];
  requestIdHeader: string;
  bodyLimitBytes: number;
};

const DEFAULT_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Cache-Control": "no-store",
};

function buildHeaders(context: Context, requestIdHeader: string, requestId: string, origin?: string) {
  const headers = new Headers();

  headers.set(requestIdHeader, requestId);

  for (const [key, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
    headers.set(key, value);
  }

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "false");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-Id");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Vary", "Origin");
  }

  return headers;
}

export function requestBaseline(config: RequestBaselineConfig) {
  return async (context: Context, next: Next) => {
    const requestId = context.req.header(config.requestIdHeader) || crypto.randomUUID();
    const origin = context.req.header("origin");

    context.set("requestId", requestId);

    const requestOrigin = new URL(context.req.url).origin;
    const isSameOrigin = origin === requestOrigin;

    const hasWildcard = config.allowedOrigins.includes("*");
    if (origin && !isSameOrigin && !hasWildcard && !config.allowedOrigins.includes(origin)) {
      throw new AppError("FORBIDDEN", "Origin is not allowed.");
    }

    const contentLength = context.req.header("content-length");
    if (contentLength) {
      const parsedLength = Number(contentLength);
      if (Number.isFinite(parsedLength) && parsedLength > config.bodyLimitBytes) {
        throw new AppError("BAD_REQUEST", "Request body is too large.");
      }
    }

    if (context.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildHeaders(context, config.requestIdHeader, requestId, origin),
      });
    }

    const start = Date.now();
    await next();
    const durationMs = Date.now() - start;
    const status = context.res.status;

    const emoji = status >= 500 ? "🔴" : status >= 400 ? "🟡" : "🟢";
    console.log(`${emoji} ${context.req.method} ${context.req.path} → ${status} (${durationMs}ms) [${requestId}]`);

    context.header(config.requestIdHeader, requestId);
    for (const [key, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
      context.header(key, value);
    }

    if (origin) {
      context.header("Access-Control-Allow-Origin", origin);
      context.header("Access-Control-Allow-Credentials", "false");
      context.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-Id");
      context.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      context.header("Vary", "Origin");
    }
  };
}