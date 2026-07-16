import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import { hashPassword, verifyPassword } from "./password";
import { issueAccessToken, verifyAccessToken } from "./token";
import type { AuthRepository, AuthUserRecord } from "./auth.repository";

const baseEnv = {
  APP_NAME: "pulih-api",
  APP_ENV: "local",
  NODE_ENV: "development",
  PORT: "3000",
  API_PREFIX: "/api/v1",
  APP_URL: "http://localhost:3000",
  PWA_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  JWT_ACCESS_SECRET: "test-secret-that-is-long-enough",
  JWT_ACCESS_TTL_SECONDS: "86400",
  PASSWORD_HASH_COST: "4",
  CORS_ALLOWED_ORIGINS: "http://localhost:3001,http://localhost:4173",
  REQUEST_ID_HEADER: "x-request-id",
} as const;

function createMemoryRepository(seed: AuthUserRecord[] = []): AuthRepository {
  const users = new Map(seed.map((user) => [user.id, user]));

  return {
    async createPatient(input) {
      const user: AuthUserRecord = {
        id: crypto.randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        role: "patient",
        status: "active",
      };
      users.set(user.id, user);
      return user;
    },
    async findByEmail(email) {
      return Array.from(users.values()).find((user) => user.email === email) ?? null;
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
  };
}

describe("password helper", () => {
  test("hashes and verifies password", async () => {
    const hash = await hashPassword("password123", 4);

    expect(hash).not.toBe("password123");
    expect(await verifyPassword("password123", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("access token", () => {
  test("issues and verifies token", async () => {
    const token = await issueAccessToken({
      user: { id: "user-1", email: "user@example.com", role: "patient", status: "active" },
      secret: "test-secret",
      ttlSeconds: 60,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    const payload = await verifyAccessToken({
      token,
      secret: "test-secret",
      now: new Date("2026-01-01T00:00:30.000Z"),
    });

    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("user@example.com");
  });

  test("rejects expired token", async () => {
    const token = await issueAccessToken({
      user: { id: "user-1", email: "user@example.com", role: "patient", status: "active" },
      secret: "test-secret",
      ttlSeconds: 1,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(verifyAccessToken({
      token,
      secret: "test-secret",
      now: new Date("2026-01-01T00:00:02.000Z"),
    })).rejects.toThrow("Access token has expired.");
  });
});

describe("auth routes", () => {
  test("registers patient and returns token", async () => {
    const app = createApp(baseEnv, {}, { authRepository: createMemoryRepository() });

    const response = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", password: "password123" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: {
        tokenType: "Bearer",
        expiresIn: 86400,
        user: { email: "patient@example.com", role: "patient" },
      },
    });
    expect(body.data.accessToken).toBeTruthy();
  });

  test("rejects duplicate email", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const app = createApp(baseEnv, {}, { authRepository: createMemoryRepository([{
      id: "user-1",
      email: "patient@example.com",
      passwordHash,
      role: "patient",
      status: "active",
    }]) });

    const response = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", password: "password123" }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  test("rejects invalid password", async () => {
    const app = createApp(baseEnv, {}, { authRepository: createMemoryRepository() });

    const response = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", password: "short" }),
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("logs in with valid credentials", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const app = createApp(baseEnv, {}, { authRepository: createMemoryRepository([{
      id: "user-1",
      email: "patient@example.com",
      passwordHash,
      role: "patient",
      status: "active",
    }]) });

    const response = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", password: "password123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.user.email).toBe("patient@example.com");
  });

  test("rejects missing, invalid, and accepts valid bearer token", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const repository = createMemoryRepository([{
      id: "user-1",
      email: "patient@example.com",
      passwordHash,
      role: "patient",
      status: "active",
    }]);
    const app = createApp(baseEnv, {}, { authRepository: repository });

    const missing = await app.request("http://localhost/api/v1/auth/me", { headers: { Origin: "http://localhost:3001" } });
    expect(missing.status).toBe(401);

    const invalid = await app.request("http://localhost/api/v1/auth/me", {
      headers: { Origin: "http://localhost:3001", Authorization: "Bearer invalid" },
    });
    expect(invalid.status).toBe(401);

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", password: "password123" }),
    });
    const loginBody = await login.json();

    const valid = await app.request("http://localhost/api/v1/auth/me", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
    });
    expect(valid.status).toBe(200);
    const validBody = await valid.json();
    expect(validBody.data.email).toBe("patient@example.com");
  });
});
