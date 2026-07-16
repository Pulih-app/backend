import { describe, expect, test } from "bun:test";
import { AppErrorCode } from "../../shared/errors";
import { createApp } from "../../app";
import { issueAccessToken } from "../auth/token";
import { createRoutineService, getJakartaLocalDate, type CheckInPayload, type RelapsePayload, type StatisticsPayload } from "./routine.service";
import type { RoutineRepository, CheckInRecord, RelapseRecord, StreakRecord } from "./routine.repository";

function offsetLocalDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function createMemoryRepository(): RoutineRepository {
  const checkIns: CheckInRecord[] = [];
  const relapses: RelapseRecord[] = [];
  let streak: StreakRecord | null = null;

  const repo: RoutineRepository = {
    async transaction(callback) { return callback(repo); },
    async findCheckInByUserAndDate(userId, localDate) {
      return checkIns.find((item) => item.userId === userId && item.localDate === localDate) ?? null;
    },
    async createCheckIn(input) {
      const record: CheckInRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input };
      checkIns.push(record);
      return record;
    },
    async findRelapseByUserAndDate(userId, localDate) {
      return relapses.find((item) => item.userId === userId && item.localDate === localDate) ?? null;
    },
    async createRelapse(input) {
      const record: RelapseRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...input };
      relapses.push(record);
      return record;
    },
    async findStreakByUserId() { return streak; },
    async upsertStreak(input) { streak = { ...input, updatedAt: new Date().toISOString() }; },
    async listCheckInsByUser(userId) { return checkIns.filter((item) => item.userId === userId); },
    async listCheckInsByUserWithinDateRange(userId, startDate, endDate) {
      return checkIns.filter((item) => item.userId === userId && item.localDate >= startDate && item.localDate <= endDate);
    },
    async listRelapses(userId) { return relapses.filter((item) => item.userId === userId); },
    async listRelapsesByUserWithinDateRange(userId, startDate, endDate) {
      return relapses.filter((item) => item.userId === userId && item.localDate >= startDate && item.localDate <= endDate);
    },
    async getCheckInCount(userId) { return checkIns.filter((item) => item.userId === userId).length; },
    async getRelapseCount(userId) { return relapses.filter((item) => item.userId === userId).length; },
    async findUserById() { return { id: "user-1", pornFreeGoal: null }; },
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

const AUTH_USER = { id: "11111111-1111-4111-8111-111111111111", email: "patient@example.com", username: null, role: "patient" as const, status: "active" };

describe("routine service", () => {
  test("uses Asia/Jakarta local date", () => {
    expect(getJakartaLocalDate(new Date("2026-01-01T17:30:00.000Z"))).toBe("2026-01-02");
  });

  test("increments streak for consecutive local dates", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    const yesterday = offsetLocalDate(today, -1);
    await service.createCheckIn("user-1", { mood: "tenang", isSuccessful: true, commitment: null, localDate: yesterday });
    const result = await service.createCheckIn("user-1", { mood: "senang", isSuccessful: true, commitment: null, localDate: today });
    expect(result.statistics.current_streak).toBe(2);
    expect(result.statistics.longest_streak).toBe(2);
    expect(result.check_in.mood).toBe("senang");
    expect(result.check_in.is_successful).toBe(true);
  });

  test("rejects duplicate check-in for same user and local date", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    await service.createCheckIn("user-1", { mood: "tenang", isSuccessful: true, commitment: null, localDate: today });
    await expect(service.createCheckIn("user-1", { mood: "senang", isSuccessful: true, commitment: null, localDate: today }))
      .rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  test("relapse resets current streak and keeps longest streak", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    const d1 = offsetLocalDate(today, -3);
    const d2 = offsetLocalDate(today, -2);
    const d3 = offsetLocalDate(today, -1);
    await service.createCheckIn("user-1", { mood: "tenang", isSuccessful: true, commitment: null, localDate: d1 });
    await service.createCheckIn("user-1", { mood: "tenang", isSuccessful: true, commitment: null, localDate: d2 });
    const result = await service.createRelapse("user-1", { mood: "cemas", triggers: ["stres"], commitment: null, localDate: d3 });
    expect(result.statistics.current_streak).toBe(0);
    expect(result.statistics.longest_streak).toBe(2);
    expect(result.relapse.relapse_trigger).toEqual(["stres"]);
  });

  test("rejects duplicate relapse for same user and local date", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    await service.createRelapse("user-1", { mood: "cemas", triggers: ["stres"], commitment: null, localDate: today });
    await expect(service.createRelapse("user-1", { mood: "sedih", triggers: ["capek"], commitment: null, localDate: today }))
      .rejects.toMatchObject({ code: AppErrorCode.Conflict });
  });

  test("relapse solution is present in response", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    const result = await service.createRelapse("user-1", { mood: "cemas", triggers: ["stres kerja"], commitment: "merasa tertekan", localDate: today });
    expect(result.relapse_solution).not.toBeNull();
    expect(result.relapse_solution!.title).toBe("Quick Recovery Steps");
    expect(result.relapse_solution!.analysis).toContain("cemas");
    expect(result.relapse_solution!.analysis).toContain("stres kerja");
  });

  test("statistics returns full payload with all fields", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    await service.createCheckIn("user-1", { mood: "tenang", isSuccessful: true, commitment: null, localDate: today });

    const stats = await service.getStatistics("user-1");
    expect(stats.current_streak).toBeGreaterThanOrEqual(0);
    expect(stats.longest_streak).toBeGreaterThanOrEqual(0);
    expect(stats.total_checkins).toBeGreaterThanOrEqual(0);
    expect(stats.total_attempts).toBeGreaterThanOrEqual(0);
    expect(stats.relapse_count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats.streak_calendar)).toBe(true);
    expect(Array.isArray(stats.relapse_calendar)).toBe(true);
    expect(Array.isArray(stats.mood_trend)).toBe(true);
    expect(Array.isArray(stats.weekday_summary)).toBe(true);
    expect(stats.weekday_summary.length).toBe(7);
    expect(stats.weekly_progress.window_days).toBe(7);
    expect(stats.monthly_progress.window_days).toBe(30);
    expect(stats.streak_goal_comparison).toBeDefined();
  });

  test("activity summary responds to window_days param", async () => {
    const repo = createMemoryRepository();
    const service = createRoutineService(repo);
    const today = getJakartaLocalDate();
    await service.createCheckIn("user-1", { mood: "tenang", isSuccessful: true, commitment: null, localDate: today });
    await service.createRelapse("user-1", { mood: "cemas", triggers: ["stres"], commitment: null, localDate: today });

    const summary = await service.getActivitySummary("user-1", 7);
    expect(summary.window_days).toBe(7);
    expect(summary.successful_checkins).toBeGreaterThanOrEqual(0);
    expect(summary.relapses).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.recent_activity)).toBe(true);
    expect(summary.recent_activity.length).toBeGreaterThan(0);
  });

  test("relapse statistics returns complete payload", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    await service.createRelapse("user-1", { mood: "cemas", triggers: ["stres", "capek"], commitment: null, localDate: today });

    const stats = await service.getRelapseStatistics("user-1");
    expect(stats.statistics).toBeDefined();
    expect(Array.isArray(stats.relapses)).toBe(true);
    expect(Array.isArray(stats.hourly_relapse_distribution)).toBe(true);
    expect(Array.isArray(stats.relapse_triggers_distribution)).toBe(true);
    expect(Array.isArray(stats.peak_relapse_hours_utc)).toBe(true);
    expect(stats.relapse_time_summary).toBeDefined();
    expect(stats.relapse_trigger_summary).toBeDefined();
  });

  test("checkInPayload format matches reference", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    const result = await service.createCheckIn("user-1", { mood: "tenang", isSuccessful: true, commitment: "tetap semangat", localDate: today });

    const ci = result.check_in;
    expect(ci.id).toBeString();
    expect(ci.user_id).toBe("user-1");
    expect(ci.check_in_date).toBe(today);
    expect(ci.check_in_day_name).toBeString();
    expect(ci.mood).toBe("tenang");
    expect(ci.is_successful).toBe(true);
    expect(ci.commitment).toBe("tetap semangat");
    expect(Array.isArray(ci.relapse_trigger)).toBe(true);
  });

  test("relapsePayload format matches reference", async () => {
    const service = createRoutineService(createMemoryRepository());
    const today = getJakartaLocalDate();
    const result = await service.createRelapse("user-1", { mood: "cemas", triggers: ["stres"], commitment: "merasa sedih", localDate: today });

    const r = result.relapse;
    expect(r.id).toBeString();
    expect(r.user_id).toBe("user-1");
    expect(r.relapse_date).toBe(today);
    expect(r.relapse_day_name).toBeString();
    expect(r.mood).toBe("cemas");
    expect(r.relapse_trigger).toEqual(["stres"]);
  });
});

describe("routine routes", () => {
  test("requires auth and saves check-in for authenticated user only", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createUser() { throw new Error("not used"); },
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findByUsername() { return null; },
        async findByLoginIdentifier() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const unauthenticated = await app.request("/api/v1/routine/checkin", { method: "POST", body: JSON.stringify({ mood: "tenang", is_successful: true }) });
    expect(unauthenticated.status).toBe(401);

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
    const response = await app.request("/api/v1/routine/checkin", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ mood: "tenang", is_successful: true, localDate: "2026-01-01" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.check_in.mood).toBe("tenang");
    expect(body.data.check_in.is_successful).toBe(true);
    expect(await repository.findCheckInByUserAndDate(AUTH_USER.id, "2026-01-01")).not.toBeNull();
    expect(await repository.findCheckInByUserAndDate("other-user", "2026-01-01")).toBeNull();
  });

  test("rejects check-in with is_successful=false", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createUser() { throw new Error("not used"); },
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findByUsername() { return null; },
        async findByLoginIdentifier() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
    const response = await app.request("/api/v1/routine/checkin", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ mood: "tenang", is_successful: false }),
    });

    expect(response.status).toBe(422);
  });

  test("rejects check-in with relapse_trigger", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createUser() { throw new Error("not used"); },
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findByUsername() { return null; },
        async findByLoginIdentifier() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
    const response = await app.request("/api/v1/routine/checkin", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ mood: "tenang", is_successful: true, relapse_trigger: ["stres"] }),
    });

    expect(response.status).toBe(422);
  });

  test("accepts content as alias for commitment", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createUser() { throw new Error("not used"); },
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findByUsername() { return null; },
        async findByLoginIdentifier() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
    const response = await app.request("/api/v1/routine/checkin", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ mood: "tenang", is_successful: true, content: "catatan hari ini" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.check_in.commitment).toBe("catatan hari ini");
  });

  test("activity summary respects window_days query param", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createUser() { throw new Error("not used"); },
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findByUsername() { return null; },
        async findByLoginIdentifier() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
    const response = await app.request("/api/v1/routine/statistics/activity-summary?window_days=7", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.window_days).toBe(7);
  });

  test("rejects invalid window_days values", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createUser() { throw new Error("not used"); },
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findByUsername() { return null; },
        async findByLoginIdentifier() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });

    const tooLow = await app.request("/api/v1/routine/statistics/activity-summary?window_days=3", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(tooLow.status).toBe(422);

    const tooHigh = await app.request("/api/v1/routine/statistics/activity-summary?window_days=100", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(tooHigh.status).toBe(422);
  });

  test("returns 200 for relapse creation", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createUser() { throw new Error("not used"); },
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findByUsername() { return null; },
        async findByLoginIdentifier() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
    const response = await app.request("/api/v1/routine/relapses", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ mood: "cemas", relapse_trigger: ["stres"] }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.relapse).toBeDefined();
    expect(body.data.relapse_solution).toBeDefined();
    expect(body.data.statistics).toBeDefined();
  });

  test("full relapse statistics returns all sections", async () => {
    const repository = createMemoryRepository();
    const app = createApp(TEST_ENV, {}, {
      authRepository: {
        async createUser() { throw new Error("not used"); },
        async createPatient() { throw new Error("not used"); },
        async findByEmail() { return null; },
        async findByUsername() { return null; },
        async findByLoginIdentifier() { return null; },
        async findById(id: string) { return id === AUTH_USER.id ? { ...AUTH_USER, passwordHash: "hash" } : null; },
      },
      routineRepository: repository,
    });

    const token = await issueAccessToken({ user: AUTH_USER, secret: TEST_ENV.JWT_ACCESS_SECRET, ttlSeconds: 60 });
    const response = await app.request("/api/v1/routine/relapses/statistics", {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.statistics).toBeDefined();
    expect(Array.isArray(body.data.relapses)).toBe(true);
    expect(Array.isArray(body.data.hourly_relapse_distribution)).toBe(true);
    expect(Array.isArray(body.data.relapse_triggers_distribution)).toBe(true);
    expect(Array.isArray(body.data.peak_relapse_hours_utc)).toBe(true);
    expect(body.data.ai_summary).toBeString();
  });
});
