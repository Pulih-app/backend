import { describe, expect, test } from "bun:test";

import { app } from "../src/app";

describe("health live route", () => {
  test("returns live status", async () => {
    const response = await app.fetch(new Request("http://localhost/health/live"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: "Service is live",
      data: {
        status: "ok",
      },
      meta: null,
    });
  });
});
