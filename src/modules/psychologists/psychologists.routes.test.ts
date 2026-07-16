import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import type { AuthRepository, AuthUserRecord } from "../auth/auth.repository";
import type { PsychologistsRepository, PsychologistProfileRecord, PsychologistBundleRecord, PsychologistSessionRecord } from "./psychologists.repository";
import type { CredentialDocumentType } from "./psychologists.types";

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

function createMemoryAuthRepository(seed: AuthUserRecord[]): AuthRepository {
  const users = new Map(seed.map((user) => [user.id, user]));
  return {
    async createPatient(input) {
      const user: AuthUserRecord = { id: crypto.randomUUID(), email: input.email, passwordHash: input.passwordHash, role: "patient", status: "active" };
      users.set(user.id, user);
      return user;
    },
    async findByEmail(email) { return Array.from(users.values()).find((user) => user.email === email) ?? null; },
    async findById(id) { return users.get(id) ?? null; },
  };
}

function createMemoryPsychologistsRepository(seed: PsychologistProfileRecord[] = []): PsychologistsRepository {
  const profiles = new Map(seed.map((profile) => [profile.userId, profile]));
  const profilesById = new Map(seed.map((profile) => [profile.id, profile]));
  const bundles = new Map<string, PsychologistBundleRecord>();
  const sessions = new Map<string, PsychologistSessionRecord[]>();
  const credentialFiles = new Map<string, Array<{ id: string; profileId: string; documentType: CredentialDocumentType; objectKey: string; fileName: string; contentType: string; sizeBytes: number }>>();

  const sync = (profile: PsychologistProfileRecord) => {
    profiles.set(profile.userId, profile);
    profilesById.set(profile.id, profile);
  };

  const clone = (profile: PsychologistProfileRecord): PsychologistProfileRecord => ({
    ...profile,
    practicePlaces: profile.practicePlaces.map((place) => ({ ...place })),
    ratingSummary: { ...profile.ratingSummary },
    latestBundle: profile.latestBundle ? { ...profile.latestBundle } : null,
  });

  return {
    async upsertProfile(input) {
      const existing = profiles.get(input.userId);
      const profile: PsychologistProfileRecord = {
        id: existing?.id ?? input.userId,
        userId: input.userId,
        type: input.type,
        consultationChannel: input.consultationChannel,
        approvalStatus: existing?.approvalStatus ?? "draft",
        fullName: input.fullName,
        licenseNumber: input.licenseNumber,
        bio: input.bio,
        practicePlaces: input.practicePlaces.map((place) => ({ id: crypto.randomUUID(), name: place.name, address: place.address, isActive: place.isActive ?? true })),
        ratingSummary: existing?.ratingSummary ?? { averageRating: 0, reviewCount: 0 },
        latestBundle: existing?.latestBundle ?? null,
      };
      sync(profile);
      return clone(profile);
    },
    async findByUserId(userId) { const profile = profiles.get(userId); return profile ? clone(profile) : null; },
    async findApprovedById(psychologistId) { const profile = profilesById.get(psychologistId); return profile && profile.approvalStatus === "approved" ? clone(profile) : null; },
    async listApproved() { return Array.from(profiles.values()).filter((profile) => profile.approvalStatus === "approved").map(clone); },
    async createCredentialFile(input) { const file = { id: crypto.randomUUID(), ...input }; const bucket = credentialFiles.get(input.profileId) ?? []; bucket.push(file); credentialFiles.set(input.profileId, bucket); return file; },
    async listCredentialFiles(profileId) { return credentialFiles.get(profileId) ?? []; },
    async findCredentialFileByOwner(userId, fileId) { const profile = profiles.get(userId); if (!profile) return null; return (credentialFiles.get(profile.id) ?? []).find((file) => file.id === fileId) ?? null; },
    async updateApprovalStatus(profileId, status) { const profile = profilesById.get(profileId); if (!profile) return; sync({ ...profile, approvalStatus: status }); },
    async listBundles(profileId) { return Array.from(bundles.values()).filter((bundle) => bundle.profileId === profileId).map((bundle) => ({ ...bundle })); },
    async findBundleById(bundleId) { const bundle = bundles.get(bundleId); return bundle ? { ...bundle } : null; },
    async createBundleWithSessions(input) {
      const bundle: PsychologistBundleRecord = { id: crypto.randomUUID(), profileId: input.profileId, packageName: input.packageName, packageDurationMinutes: input.packageDurationMinutes, priceAmount: input.priceAmount, dateStart: input.dateStart, dateEnd: input.dateEnd, dailyStartTime: input.dailyStartTime, dailyEndTime: input.dailyEndTime };
      bundles.set(bundle.id, bundle);
      sessions.set(bundle.id, input.sessions.map((session) => ({ id: crypto.randomUUID(), bundleId: bundle.id, profileId: input.profileId, ...session, priceAmount: input.priceAmount, packageName: input.packageName, packageDurationMinutes: input.packageDurationMinutes })));
      const profile = profilesById.get(input.profileId);
      if (profile) sync({ ...profile, latestBundle: { ...bundle } });
      return { ...bundle };
    },
    async updateBundleWithSessions(bundleId, input) {
      const bundle = bundles.get(bundleId);
      if (!bundle) return null;
      const updated = { ...bundle, packageName: input.packageName, packageDurationMinutes: input.packageDurationMinutes, priceAmount: input.priceAmount, dateStart: input.dateStart, dateEnd: input.dateEnd, dailyStartTime: input.dailyStartTime, dailyEndTime: input.dailyEndTime };
      bundles.set(bundleId, updated);
      sessions.set(bundleId, input.sessions.map((session) => ({ id: crypto.randomUUID(), bundleId, profileId: bundle.profileId, ...session, priceAmount: input.priceAmount, packageName: input.packageName, packageDurationMinutes: input.packageDurationMinutes })));
      return { ...updated };
    },
    async deleteBundle(bundleId) { return bundles.delete(bundleId); },
    async deleteSessionsByBundleId(bundleId) { sessions.delete(bundleId); },
    async listSessionsByPsychologistId(psychologistId) { return Array.from(sessions.values()).flat().filter((session) => session.profileId === psychologistId).map((session) => ({ ...session })); },
    async listSessionsByBundleIds(bundleIds) { return bundleIds.flatMap((bundleId) => sessions.get(bundleId) ?? []).map((session) => ({ ...session })); },
  };
}

describe("psychologist directory and bundles", () => {
  test("hides pending psychologist and exposes approved detail with rating summary", async () => {
    const psychologistsRepository = createMemoryPsychologistsRepository([
      {
        id: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        type: "clinical",
        consultationChannel: "chat_and_meet",
        approvalStatus: "approved",
        fullName: "Dr. Approved",
        licenseNumber: "LIC-1",
        bio: "Bio",
        practicePlaces: [],
        ratingSummary: { averageRating: 4.8, reviewCount: 12 },
        latestBundle: null,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        userId: "44444444-4444-4444-8444-444444444444",
        type: "general",
        consultationChannel: "chat",
        approvalStatus: "pending_review",
        fullName: "Dr. Pending",
        licenseNumber: "LIC-2",
        bio: "Bio",
        practicePlaces: [],
        ratingSummary: { averageRating: 0, reviewCount: 0 },
        latestBundle: null,
      },
    ]);
    const app = createApp(baseEnv, {}, { authRepository: createMemoryAuthRepository([]), psychologistsRepository });

    const list = await app.request("http://localhost/api/v1/psychologists", { headers: { Origin: "http://localhost:3001" } });
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].consultationChannel).toBe("chat_and_meet");
    expect(listBody.data[0].ratingSummary).toMatchObject({ averageRating: 4.8, reviewCount: 12 });

    const detail = await app.request("http://localhost/api/v1/psychologists/11111111-1111-4111-8111-111111111111", { headers: { Origin: "http://localhost:3001" } });
    expect(detail.status).toBe(200);

    const hidden = await app.request("http://localhost/api/v1/psychologists/33333333-3333-4333-8333-333333333333", { headers: { Origin: "http://localhost:3001" } });
    expect(hidden.status).toBe(404);
  });

  test("creates bundle, derives package name, and exposes generated sessions", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository });

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "approved@example.com", password: "password123" }),
    });
    const registerBody = await register.json();
    const token = registerBody.data.accessToken as string;
    const userId = registerBody.data.user.id as string;

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "clinical", fullName: "Dr. Approved" }),
    });
    await psychologistsRepository.updateApprovalStatus(userId, "approved");

    const create = await app.request("http://localhost/api/v1/psychologists/me/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        dateStart: "2026-02-01",
        dateEnd: "2026-02-02",
        dailyStartTime: "08:00",
        dailyEndTime: "11:00",
        priceAmount: 150000,
      }),
    });
    expect(create.status).toBe(201);
    const createBody = await create.json();
    expect(createBody.data.bundle.packageName).toBe("Paket 3 Jam");
    expect(createBody.data.sessions).toHaveLength(2);

    const sessions = await app.request(`http://localhost/api/v1/psychologists/${userId}/sessions`, { headers: { Origin: "http://localhost:3001" } });
    expect(sessions.status).toBe(200);
    const sessionsBody = await sessions.json();
    expect(sessionsBody.data).toHaveLength(2);
  });

  test("rejects invalid bundle times, overlap, and ownership mismatch", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository });

    const ownerRegister = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "owner@example.com", password: "password123" }),
    });
    const ownerBody = await ownerRegister.json();
    const ownerToken = ownerBody.data.accessToken as string;
    const ownerUserId = ownerBody.data.user.id as string;

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ type: "clinical", fullName: "Dr. Owner" }),
    });
    await psychologistsRepository.updateApprovalStatus(ownerUserId, "approved");

    const invalid = await app.request("http://localhost/api/v1/psychologists/me/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        dateStart: "2026-02-01",
        dateEnd: "2026-02-01",
        dailyStartTime: "12:00",
        dailyEndTime: "10:00",
        priceAmount: 150000,
      }),
    });
    expect(invalid.status).toBe(422);

    const first = await app.request("http://localhost/api/v1/psychologists/me/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        dateStart: "2026-02-01",
        dateEnd: "2026-02-01",
        dailyStartTime: "08:00",
        dailyEndTime: "10:00",
        priceAmount: 150000,
      }),
    });
    const firstBody = await first.json();

    const overlap = await app.request("http://localhost/api/v1/psychologists/me/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        dateStart: "2026-02-01",
        dateEnd: "2026-02-01",
        dailyStartTime: "09:00",
        dailyEndTime: "11:00",
        priceAmount: 150000,
      }),
    });
    expect(overlap.status).toBe(409);

    const otherRegister = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "other@example.com", password: "password123" }),
    });
    const otherBody = await otherRegister.json();
    const otherToken = otherBody.data.accessToken as string;

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${otherToken}` },
      body: JSON.stringify({ type: "clinical", fullName: "Dr. Other" }),
    });
    await psychologistsRepository.updateApprovalStatus(otherBody.data.user.id as string, "approved");

    const updateForbidden = await app.request(`http://localhost/api/v1/psychologists/me/bundles/${firstBody.data.bundle.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${otherToken}` },
      body: JSON.stringify({
        dateStart: "2026-02-02",
        dateEnd: "2026-02-02",
        dailyStartTime: "08:00",
        dailyEndTime: "10:00",
        priceAmount: 160000,
      }),
    });
    expect(updateForbidden.status).toBe(403);

    const deleteForbidden = await app.request(`http://localhost/api/v1/psychologists/me/bundles/${firstBody.data.bundle.id}`, {
      method: "DELETE",
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${otherToken}` },
    });
    expect(deleteForbidden.status).toBe(403);
  });
});
