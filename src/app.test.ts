import { describe, expect, test } from "bun:test";
import { createApp } from "./app";

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
  JWT_ACCESS_SECRET: "replace-with-strong-secret",
  JWT_ACCESS_TTL_SECONDS: "86400",
  PASSWORD_HASH_COST: "10",
  CORS_ALLOWED_ORIGINS: "http://localhost:3001,http://localhost:4173",
  REQUEST_ID_HEADER: "x-request-id",
} as const;

describe("request baseline", () => {
  test("adds request id and secure headers", async () => {
    const app = createApp(baseEnv);

    const response = await app.request("http://localhost/health/live", {
      headers: {
        Origin: "http://localhost:3001",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3001");
  });

  test("allows same-origin API docs requests without CORS allowlist entry", async () => {
    const app = createApp(baseEnv);

    const response = await app.request("http://localhost/api/v1/validation-demo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: JSON.stringify({ name: "Pulih Demo", email: "demo@example.com" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost");
  });

  test("rejects disallowed origin", async () => {
    const app = createApp(baseEnv);

    const response = await app.request("http://localhost/health/live", {
      headers: {
        Origin: "http://evil.example",
      },
    });

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "FORBIDDEN",
      },
    });
    expect(body.error.request_id).toBeTruthy();
  });
});

describe("docs", () => {
  test("uses configured app url in OpenAPI server and curl samples", async () => {
    const app = createApp({ ...baseEnv, APP_URL: "https://pulih.salmanabdurrahman.my.id" });

    const response = await app.request("http://localhost/openapi.json");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.servers[0].url).toBe("https://pulih.salmanabdurrahman.my.id");
    expect(body.paths["/health/live"].get["x-codeSamples"][0].source).toBe("curl -X GET https://pulih.salmanabdurrahman.my.id/health/live");
  });

  test("uses production OpenAPI default when production app url is localhost", async () => {
    const app = createApp({ ...baseEnv, APP_ENV: "production", APP_URL: "http://localhost:3001" });

    const response = await app.request("http://localhost/openapi.json");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.servers[0].url).toBe("https://pulih.salmanabdurrahman.my.id");
    expect(body.paths["/api/v1/auth/register"].post["x-codeSamples"][0].source).toBe("curl -X POST https://pulih.salmanabdurrahman.my.id/api/v1/auth/register");
  });
});

describe("validation helper", () => {
  test("returns validation error for invalid body", async () => {
    const app = createApp(baseEnv);

    const response = await app.request("http://localhost/api/v1/validation-demo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3001",
      },
      body: JSON.stringify({ email: "demo@example.com" }),
    });

    expect(response.status).toBe(422);

    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.request_id).toBeTruthy();
  });

  test("accepts valid body", async () => {
    const app = createApp(baseEnv);

    const response = await app.request("http://localhost/api/v1/validation-demo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3001",
      },
      body: JSON.stringify({ name: "Pulih Demo", email: "demo@example.com" }),
    });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: {
        received: {
          name: "Pulih Demo",
          email: "demo@example.com",
        },
      },
    });
  });
});