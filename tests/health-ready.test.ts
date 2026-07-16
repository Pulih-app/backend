import { describe, expect, test } from "bun:test";

import { createApp } from "../src/app";

describe("health ready route", () => {
  test("returns ready status after database check", async () => {
    let called = 0;
    const app = createApp({}, {}, {
      databaseHealthCheck: async () => {
        called += 1;
      },
    });

    const response = await app.fetch(new Request("http://localhost/health/ready"));

    expect(called).toBe(1);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: "Service is ready",
      data: {
        status: "ok",
      },
      meta: null,
    });
  });
});
