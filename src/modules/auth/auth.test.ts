import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import { hashPassword, verifyPassword } from "./password";
import { issueAccessToken, verifyAccessToken } from "./token";
import { validateCredentialFile } from "../psychologists/psychologists.service";
import type { AuthRepository, AuthUserRecord } from "./auth.repository";
import type { UserProfileRecord, UsersRepository, UserSettingsUpdate } from "../users/users.repository";
import type { PsychologistProfileRecord, PsychologistsRepository } from "../psychologists/psychologists.repository";
import type { CredentialStorage } from "../psychologists/credential-storage";
import { channelForType, type CredentialDocumentType } from "../psychologists/psychologists.types";

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

function createMemoryUsersRepository(seed: UserProfileRecord[] = []): UsersRepository {
  const profiles = new Map(seed.map((profile) => [profile.userId, profile]));

  function baseProfile(userId: string): UserProfileRecord {
    return profiles.get(userId) ?? {
      id: crypto.randomUUID(),
      userId,
      email: "patient@example.com",
      role: "patient",
      status: "active",
      displayName: null,
      nickname: null,
      recoveryGoal: null,
      checkInTime: null,
      onboardingCompletedAt: null,
    };
  }

  function applyUpdate(userId: string, input: UserSettingsUpdate, onboardingCompletedAt?: Date | null) {
    const existing = baseProfile(userId);
    const updated: UserProfileRecord = {
      ...existing,
      displayName: input.displayName !== undefined ? input.displayName : existing.displayName,
      nickname: input.nickname !== undefined ? input.nickname : existing.nickname,
      recoveryGoal: input.recoveryGoal !== undefined ? input.recoveryGoal : existing.recoveryGoal,
      checkInTime: input.checkInTime !== undefined ? input.checkInTime : existing.checkInTime,
      onboardingCompletedAt: onboardingCompletedAt ?? existing.onboardingCompletedAt,
    };
    profiles.set(userId, updated);
    return updated;
  }

  return {
    async findCurrentUser(userId) {
      return profiles.get(userId) ?? baseProfile(userId);
    },
    async updateSettings(userId, input) {
      return applyUpdate(userId, input);
    },
    async completeOnboarding(userId, input) {
      return applyUpdate(userId, input, new Date("2026-01-01T00:00:00.000Z"));
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

describe("users routes", () => {
  test("reads own profile and rejects unknown fields on settings", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryRepository([{
      id: "user-1",
      email: "patient@example.com",
      passwordHash,
      role: "patient",
      status: "active",
    }]);
    const usersRepository = createMemoryUsersRepository([{
      id: "profile-1",
      userId: "user-1",
      email: "patient@example.com",
      role: "patient",
      status: "active",
      displayName: "Patient",
      nickname: null,
      recoveryGoal: "Recover",
      checkInTime: "08:00:00",
      onboardingCompletedAt: null,
    }]);
    const app = createApp(baseEnv, {}, { authRepository, usersRepository });

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", password: "password123" }),
    });
    const loginBody = await login.json();

    const me = await app.request("http://localhost/api/v1/users/me", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
    });
    expect(me.status).toBe(200);
    const meBody = await me.json();
    expect(meBody.data.displayName).toBe("Patient");

    const invalid = await app.request("http://localhost/api/v1/users/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
      body: JSON.stringify({ displayName: "New", unknownField: true }),
    });
    expect(invalid.status).toBe(422);
  });

  test("updates settings and completes onboarding", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryRepository([{
      id: "user-1",
      email: "patient@example.com",
      passwordHash,
      role: "patient",
      status: "active",
    }]);
    const usersRepository = createMemoryUsersRepository();
    const app = createApp(baseEnv, {}, { authRepository, usersRepository });

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", password: "password123" }),
    });
    const loginBody = await login.json();

    const settings = await app.request("http://localhost/api/v1/users/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
      body: JSON.stringify({ displayName: "New Name", recoveryGoal: "Stay clean", checkInTime: "07:30" }),
    });
    expect(settings.status).toBe(200);
    const settingsBody = await settings.json();
    expect(settingsBody.data.displayName).toBe("New Name");
    expect(settingsBody.data.checkInTime).toBe("07:30:00");

    const onboarding = await app.request("http://localhost/api/v1/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
      body: JSON.stringify({ recoveryGoal: "Stay clean", checkInTime: "07:30" }),
    });
    expect(onboarding.status).toBe(200);
    const onboardingBody = await onboarding.json();
    expect(onboardingBody.data.onboardingCompletedAt).toBeTruthy();
  });
});

describe("psychologist routes", () => {
  function createMemoryPsychologistsRepository(seed: PsychologistProfileRecord[] = []): PsychologistsRepository {
    const profiles = new Map(seed.map((profile) => [profile.userId, profile]));
    const files = new Map<string, Array<{ id: string; profileId: string; documentType: CredentialDocumentType; objectKey: string; fileName: string; contentType: string; sizeBytes: number }>>();

    return {
      async upsertProfile(input) {
        const profile: PsychologistProfileRecord = {
          id: profiles.get(input.userId)?.id ?? input.userId,
          userId: input.userId,
          type: input.type,
          consultationChannel: input.consultationChannel,
          approvalStatus: "draft",
          fullName: input.fullName,
          licenseNumber: input.licenseNumber,
          bio: input.bio,
          practicePlaces: input.practicePlaces.map((place) => ({ id: crypto.randomUUID(), name: place.name, address: place.address, isActive: place.isActive ?? true })),
          ratingSummary: { averageRating: 0, reviewCount: 0 },
          latestBundle: null,
        };
        profiles.set(input.userId, profile);
        return profile;
      },
      async findByUserId(userId) {
        return profiles.get(userId) ?? null;
      },
      async findApprovedById(psychologistId) {
        const profile = Array.from(profiles.values()).find((item) => item.id === psychologistId && item.approvalStatus === "approved");
        return profile ?? null;
      },
      async listApproved() {
        return Array.from(profiles.values()).filter((profile) => profile.approvalStatus === "approved");
      },
      async createCredentialFile(input) {
        const file = { id: crypto.randomUUID(), ...input };
        const bucket = files.get(input.profileId) ?? [];
        bucket.push(file);
        files.set(input.profileId, bucket);
        return file;
      },
      async listCredentialFiles(profileId) {
        return files.get(profileId) ?? [];
      },
      async findCredentialFileByOwner(userId, fileId) {
        const profile = profiles.get(userId);
        if (!profile) return null;
        return (files.get(profile.id) ?? []).find((file) => file.id === fileId) ?? null;
      },
      async updateApprovalStatus(profileId, status) {
        for (const [userId, profile] of profiles.entries()) {
          if (profile.id === profileId) {
            profiles.set(userId, { ...profile, approvalStatus: status });
          }
        }
      },
      async listBundles() {
        return [];
      },
      async findBundleById() {
        return null;
      },
      async createBundleWithSessions() {
        throw new Error("not used");
      },
      async updateBundleWithSessions() {
        throw new Error("not used");
      },
      async deleteBundle() {
        return true;
      },
      async deleteSessionsByBundleId() {
        return undefined;
      },
      async listSessionsByPsychologistId() {
        return [];
      },
      async listSessionsByBundleIds() {
        return [];
      },
    };
  }

  const credentialStorage: CredentialStorage = {
    async put() {
      return undefined;
    },
  };

  test("creates psychologist profile and derives consultation channel", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryRepository([{ id: "user-1", email: "psych@example.com", passwordHash, role: "patient", status: "active" }]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository, credentialStorage });

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "psych@example.com", password: "password123" }),
    });
    const loginBody = await login.json();

    const register = await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
      body: JSON.stringify({ type: "general", fullName: "Dr. General", practicePlaces: [] }),
    });
    expect(register.status).toBe(201);
    const registerBody = await register.json();
    expect(registerBody.data.consultationChannel).toBe("chat");
  });

  test("rejects more than 3 active practice places for clinical psychologist", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryRepository([{ id: "user-1", email: "psych@example.com", passwordHash, role: "patient", status: "active" }]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository, credentialStorage });

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "psych@example.com", password: "password123" }),
    });
    const loginBody = await login.json();

    const response = await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
      body: JSON.stringify({
        type: "clinical",
        fullName: "Dr. Clinical",
        practicePlaces: [
          { name: "A", address: "X" },
          { name: "B", address: "Y" },
          { name: "C", address: "Z" },
          { name: "D", address: "W" },
        ],
      }),
    });

    expect(response.status).toBe(422);
  });

  test("uploads credential file and blocks submit-for-review until required files exist", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryRepository([{ id: "user-1", email: "psych@example.com", passwordHash, role: "patient", status: "active" }]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository, credentialStorage });

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "psych@example.com", password: "password123" }),
    });
    const loginBody = await login.json();

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
      body: JSON.stringify({ type: "general", fullName: "Dr. General", practicePlaces: [] }),
    });

    const form = new FormData();
    form.set("documentType", "sipp");
    form.set("file", new File([new Uint8Array([1, 2, 3])], "license.pdf", { type: "application/pdf" }));

    const upload = await app.request("http://localhost/api/v1/psychologists/me/credential-file", {
      method: "POST",
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
      body: form,
    });
    expect(upload.status).toBe(201);

    const submit = await app.request("http://localhost/api/v1/psychologists/me/submit-for-review", {
      method: "POST",
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${loginBody.data.accessToken}` },
    });
    expect(submit.status).toBe(409);
  });

  test("rejects invalid credential file type and size", () => {
    expect(() => validateCredentialFile(new File([new Uint8Array([1])], "note.txt", { type: "text/plain" }))).toThrow("Request validation failed.");
    expect(() => validateCredentialFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" }))).toThrow("Request validation failed.");
  });

  test("returns review url only for owner", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryRepository([
      { id: "user-1", email: "psych@example.com", passwordHash, role: "patient", status: "active" },
      { id: "user-2", email: "other@example.com", passwordHash, role: "patient", status: "active" },
    ]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository, credentialStorage });

    const login1 = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "psych@example.com", password: "password123" }),
    });
    const login1Body = await login1.json();

    const login2 = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "other@example.com", password: "password123" }),
    });
    const login2Body = await login2.json();

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${login1Body.data.accessToken}` },
      body: JSON.stringify({ type: "general", fullName: "Dr. General", practicePlaces: [] }),
    });

    const form = new FormData();
    form.set("documentType", "sipp");
    form.set("file", new File([new Uint8Array([1, 2, 3])], "license.pdf", { type: "application/pdf" }));
    const upload = await app.request("http://localhost/api/v1/psychologists/me/credential-file", {
      method: "POST",
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${login1Body.data.accessToken}` },
      body: form,
    });
    const uploadBody = await upload.json();

    const owner = await app.request(`http://localhost/api/v1/psychologists/me/credential-file/${uploadBody.data.id}/review-url`, {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${login1Body.data.accessToken}` },
    });
    expect(owner.status).toBe(200);

    const other = await app.request(`http://localhost/api/v1/psychologists/me/credential-file/${uploadBody.data.id}/review-url`, {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${login2Body.data.accessToken}` },
    });
    expect(other.status).toBe(404);
  });
});
