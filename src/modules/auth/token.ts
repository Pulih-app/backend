import { AppError, AppErrorCode } from "../../shared/errors";
import type { AuthUser, TokenPayload } from "./auth.types";

const encoder = new TextEncoder();

function base64UrlEncode(input: string | ArrayBuffer) {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecodeBytes(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64UrlDecode(input: string) {
  return new TextDecoder().decode(base64UrlDecodeBytes(input));
}

async function importKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function issueAccessToken(input: { user: AuthUser; secret: string; ttlSeconds: number; now?: Date }) {
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: TokenPayload = {
    sub: input.user.id,
    email: input.user.email,
    role: input.user.role,
    status: input.user.status,
    iat: nowSeconds,
    exp: nowSeconds + input.ttlSeconds,
  };

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign("HMAC", await importKey(input.secret), encoder.encode(unsigned));

  return `${unsigned}.${base64UrlEncode(signature)}`;
}

export async function verifyAccessToken(input: { token: string; secret: string; now?: Date }): Promise<TokenPayload> {
  const parts = input.token.split(".");
  if (parts.length !== 3) {
    throw new AppError(AppErrorCode.Unauthenticated, "Invalid access token.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  let valid = false;

  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await importKey(input.secret),
      base64UrlDecodeBytes(encodedSignature),
      encoder.encode(unsigned),
    );
  } catch {
    throw new AppError(AppErrorCode.Unauthenticated, "Invalid access token.");
  }

  if (!valid) {
    throw new AppError(AppErrorCode.Unauthenticated, "Invalid access token.");
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new AppError(AppErrorCode.Unauthenticated, "Invalid access token.");
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!payload.sub || payload.exp <= nowSeconds) {
    throw new AppError(AppErrorCode.Unauthenticated, "Access token has expired.");
  }

  return payload;
}
