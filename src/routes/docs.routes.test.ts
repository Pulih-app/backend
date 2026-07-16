import { describe, expect, test } from "bun:test";
import { createApp } from "../app";

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

describe("docs routes", () => {
  test("serves openapi artifact and scalar page", async () => {
    const app = createApp(baseEnv);

    const specResponse = await app.request("http://localhost/openapi.yaml");
    expect(specResponse.status).toBe(200);
    expect(specResponse.headers.get("content-type")).toContain("application/yaml");
    const specBody = await specResponse.text();
    expect(specBody).toContain('openapi: "3.1.0"');

    const docsResponse = await app.request("http://localhost/docs/api");
    expect(docsResponse.status).toBe(200);
    expect(docsResponse.headers.get("content-type")).toContain("text/html");
    const docsBody = await docsResponse.text();
    expect(docsBody).toContain("Scalar.createApiReference");
    expect(docsBody).not.toContain("Complete Pulih API reference");
    expect(docsBody).not.toContain("Open JSON");
    expect(docsBody).not.toContain("Route inventory");
  });
});
