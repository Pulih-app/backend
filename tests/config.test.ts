import { describe, expect, test } from "bun:test";

import { ConfigError, loadConfig } from "../src/shared/config";

const validEnv = {
  APP_NAME: "pulih-api",
  APP_ENV: "local",
  NODE_ENV: "development",
  PORT: "3000",
  API_PREFIX: "/api/v1",
  APP_URL: "http://localhost:3000",
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
    expect(config.app.port).toBe(3000);
    expect(config.app.apiPrefix).toBe("/api/v1");
    expect(config.security.corsAllowedOrigins).toEqual([
      "http://localhost:3001",
      "http://localhost:4173",
    ]);
    expect(config.database.directDatabaseUrl).toBe(
      "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
    );
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
});
