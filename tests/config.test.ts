import { describe, expect, test } from "bun:test";

import { ConfigError, loadConfig } from "../src/shared/config";

const validEnv = {
  APP_NAME: "pulih-api",
  APP_ENV: "local",
  NODE_ENV: "development",
  PORT: "3002",
  API_PREFIX: "/api/v1",
  APP_URL: "http://localhost:3002",
  PWA_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  JWT_ACCESS_SECRET: "replace-with-strong-secret",
  JWT_ACCESS_TTL_SECONDS: "86400",
  PASSWORD_HASH_COST: "10",
  CORS_ALLOWED_ORIGINS: "http://localhost:3001,http://localhost:4173",
  REQUEST_ID_HEADER: "x-request-id",
} as const;

describe("loadConfig", () => {
  test("returns parsed config for valid env", () => {
    const config = loadConfig(validEnv);

    expect(config.app.appName).toBe("pulih-api");
    expect(config.app.port).toBe(3002);
    expect(config.app.apiPrefix).toBe("/api/v1");
    expect(config.security.corsAllowedOrigins).toEqual([
      "http://localhost:3001",
      "http://localhost:4173",
    ]);
    expect(config.database.directDatabaseUrl).toBe(
      "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
    );
    expect(config.database.poolMax).toBe(10);
    expect(config.database.poolIdleTimeoutMs).toBe(30000);
  });

  test("fails fast when required env missing", () => {
    expect(() => loadConfig({ ...validEnv, APP_NAME: undefined })).toThrow(ConfigError);

    try {
      loadConfig({ ...validEnv, APP_NAME: undefined });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues).toContain("APP_NAME is required");
    }
  });

  test("rejects invalid env values", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        APP_ENV: "dev",
        PORT: "99999",
        APP_URL: "localhost:3000",
        CORS_ALLOWED_ORIGINS: "not-a-url",
      }),
    ).toThrow(ConfigError);
  });

  test("rejects api prefix without leading slash", () => {
    expect(() => loadConfig({ ...validEnv, API_PREFIX: "api/v1" })).toThrow(ConfigError);
  });

  test("uses OpenRouter-compatible default model when OpenRouter base URL is configured", () => {
    const config = loadConfig({ ...validEnv, AI_BASE_URL: "https://openrouter.ai/api/v1" });

    expect(config.ai?.model).toBe("google/gemini-2.5-flash-lite");
  });

  test("normalizes explicit GPT model for OpenRouter", () => {
    const config = loadConfig({
      ...validEnv,
      AI_BASE_URL: "https://openrouter.ai/api/v1",
      AI_MODEL: "gpt-4o-mini",
    });

    expect(config.ai?.model).toBe("openai/gpt-4o-mini");
  });

  test("loads AI defaults when config omitted", () => {
    const config = loadConfig(validEnv);

    expect(config.ai?.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(config.ai?.apiKey).toBe("local-ai-api-key");
    expect(config.ai?.timeoutMs).toBe(10000);
    expect(config.ai?.maxTokens).toBe(800);
    expect(config.ai?.model).toBe("google/gemini-2.5-flash-lite");
  });
});
