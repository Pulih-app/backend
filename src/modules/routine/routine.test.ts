import { describe, expect, test } from "bun:test";
import { AppErrorCode } from "../../shared/errors";
import { createApp } from "../../app";
import { issueAccessToken } from "../auth/token";
import { createRoutineService, getJakartaLocalDate } from "./routine.service";
import type { RoutineRepository, CheckInRecord, RelapseRecord, StreakRecord } from "./routine.repository";

function createMemoryRepository(): RoutineRepository {
  const checkIns: CheckInRecord[] = [];
  const relapses: RelapseRecord[] = [];
  let streak: StreakRecord | null = null;
  const repo: RoutineRepository = {
    async transaction(callback) { return callback(repo); },
    async findCheckInByUserAndDate(userId, localDate) { return checkIns.find((item) => item.userId === userId && item.localDate === localDate) ?? null; },
    async createCheckIn(input) {
      const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input };
      checkIns.push(record);
      return record;
    },
    async createRelapse(input) {
      const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input };
      relapses.push(record);
      return record;
    },
    async findStreakByUserId() { return streak; },
    async upsertStreak(input) { streak = { ...input, updatedAt: new Date().toISOString() }; },
    async getSummary(userId) { return { checkInCount: checkIns.filter((item) => item.userId === userId).length, relapseCount: relapses.filter((item) => item.userId === userId).length }; },
    async getActivitySummary(userId, windowDays) { return { windowDays, successfulCheckIns: checkIns.filter((item) => item.userId === userId).length, relapses: relapses.filter((item) => item.userId === userId).length }; },
    async listRelapses(userId) { return relapses.filter((item) => item.userId === userId); },
    async getRelapseStatistics(userId) {
      const counts = new Map<string, number>();
      for (const relapse of relapses.filter((item) => item.userId === userId)) for (const trigger of relapse.triggers) counts.set(trigger, (counts.get(trigger) ?? 0) + 1);
      return { relapseCount: relapses.length, topTriggers: [...counts.entries()].map(([trigger, count]) => ({ trigger, count })) };
    },
  };
  return repo;
}

const TEST_ENV = {
  APP_NAME: "pulih-api",
  APP_ENV: "local",
  NODE_ENV: "test",
  API_PREFIX: "/api/v1",
  APP_URL: "http://localhost:3000",
  PWA_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  DIRECT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/pulih_db?sslmode=disable",
  JWT_ACCESS_SECRET: "test-secret",
  JWT_ACCESS_TTL_SECONDS: "86400",
  PASSWORD_HASH_COST: "4",
  CORS_ALLOWED_ORIGINS: "http://localhost:3001",
  REQUEST_ID_HEADER: "x-request-id",
  PAKASIR_API_KEY: "test-pakasir-key",
};

const AUTH_USER = { id: "11111111-1111-4111-8111-111111111111", email: "patient@example.com", role: "patient" as const, status: "active" };

describe("routine service", () => {
  test("uses Asia/Jakarta local date", () => {
    expect(getJakartaLocalDate(new Date("2026-01-01T17:30:00.000Z"))).toBe("2026-01-02");
  });

  test("increments streak for consecutive local dates", async () => {
    const service = createRoutineService(createMemoryRepository());
    await service.createCheckIn("user-1", { mood: 4, note: null, localDate: "2026-01-01" });
    const result = await service.createCheckIn("user-1", { mood: 5, note: null, localDate: "2026-01-02" });
    expect(result.streak?.currentStreak).toBe(2);
    expect(result.streak?.longestStreak).toBe(2);
  });

  test("rejects duplicate check-in for same user and local date", async () => {
    const service = createRoutineService(createMemoryRepository());
    await service.createCheckIn("user-1", { mood: 4, note: null, localDate: "2026-01-01" });
    await expect(service.createCheckIn("user-1", { mood: 5, note: null, localDate: "2026-01-01" })).rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  test("relapse resets current streak and keeps longest streak", async () => {
    const service = createRoutineService(createMemoryRepository());
    await service.createCheckIn("user-1", { mood: 4, note: null, localDate: "2026-01-01" });
    await service.createCheckIn("user-1", { mood: 4, note: null, localDate: "2026-01-02" });
    const result = await service.createRelapse("user-1", { mood: 2, triggers: ["stress"], note: null, localDate: "2026-01-03" });
    expect(result.streak?.currentStreak).toBe(0);
    expect(result.streak?.longestStreak).toBe(2);
  });
});

describe("routine routes", () => {
  test("requires auth and saves check-in for authenticated user only", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const unauthenticated = await app.request("/api/v1/routine/checkin", { method: "POST", body: JSON.stringify({ mood: 4 }) });
    expect(unauthenticated.status).toBe(401);

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
    const response = await app.request("/api/v1/routine/checkin", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ mood: 4, localDate: "2026-01-01" }),
    });

    expect(response.status).toBe(201);
    expect(await repository.findCheckInByUserAndDate(AUTH_USER.id, "2026-01-01")).not.toBeNull();
    expect(await repository.findCheckInByUserAndDate("other-user", "2026-01-01")).toBeNull();
  });
});
