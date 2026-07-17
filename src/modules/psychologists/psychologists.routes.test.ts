import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import type { AuthRepository, AuthUserRecord } from "../auth/auth.repository";
import type { PsychologistsRepository, PsychologistProfileRecord, PsychologistBundleRecord, PsychologistSessionRecord, PublicPsychologistSessionRecord } from "./psychologists.repository";
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
    async createUser(input) {
      const user: AuthUserRecord = { id: crypto.randomUUID(), email: input.email, username: input.username, passwordHash: input.passwordHash, role: input.role, status: "active" };
      users.set(user.id, user);
      return user;
    },
    async createPatient(input) {
      return this.createUser({ ...input, role: "patient" });
    },
    async findByEmail(email) { return Array.from(users.values()).find((user) => user.email === email) ?? null; },
    async findByUsername(username) { return Array.from(users.values()).find((user) => user.username === username) ?? null; },
    async findByLoginIdentifier(identifier: string) { return Array.from(users.values()).find((u) => u.email === identifier || u.username === identifier) ?? null; },
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
    ratingSummary: { ...profile.ratingSummary },
    latestReviews: profile.latestReviews.map((review) => ({ ...review })),
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
        dateOfBirth: input.dateOfBirth,
        address: input.address,
        photoUrl: input.photoUrl,
        bio: input.bio,
        ratingSummary: existing?.ratingSummary ?? { averageRating: 0, reviewCount: 0 },
        latestReviews: existing?.latestReviews ?? [],
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
    async listApprovedAvailableSessions() {
      const result: PublicPsychologistSessionRecord[] = [];
      for (const session of Array.from(sessions.values()).flat()) {
        if (session.status !== "available") continue;
        const profile = profilesById.get(session.profileId);
        if (!profile || profile.approvalStatus !== "approved") continue;
        result.push({
          ...session,
          psychologist: {
            id: profile.id,
            userId: profile.userId,
            type: profile.type,
            consultationChannel: profile.consultationChannel,
            fullName: profile.fullName,
            dateOfBirth: profile.dateOfBirth,
            address: profile.address,
            photoUrl: profile.photoUrl,
            bio: profile.bio,
            ratingSummary: { ...profile.ratingSummary },
            latestReviews: profile.latestReviews.map((review) => ({ ...review })),
          },
        });
      }
      return result;
    },
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
        dateOfBirth: "1990-01-01",
        address: "Jl. Demo",
        photoUrl: "https://example.com/photo.jpg",
        bio: "Bio",
        ratingSummary: { averageRating: 4.8, reviewCount: 12 },
        latestReviews: [{ id: "review-1", bookingId: "booking-1", patientUserId: "patient-1", psychologistProfileId: "11111111-1111-4111-8111-111111111111", rating: 5, comment: "Helpful", createdAt: "2026-07-16T01:10:00.000Z", updatedAt: "2026-07-16T01:10:00.000Z" }],
        latestBundle: null,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        userId: "44444444-4444-4444-8444-444444444444",
        type: "general",
        consultationChannel: "chat",
        approvalStatus: "pending_review",
        fullName: "Dr. Pending",
        dateOfBirth: "1991-02-02",
        address: "Jl. Contoh",
        photoUrl: "https://example.com/photo2.jpg",
        bio: "Bio",
        ratingSummary: { averageRating: 0, reviewCount: 0 },
        latestReviews: [],
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
    expect(listBody.data[0].latestReviews).toHaveLength(1);
    expect(listBody.data[0].latestReviews[0]).toMatchObject({ rating: 5, comment: "Helpful" });

    const detail = await app.request("http://localhost/api/v1/psychologists/11111111-1111-4111-8111-111111111111", { headers: { Origin: "http://localhost:3001" } });
    expect(detail.status).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.data.latestReviews).toHaveLength(1);

    const hidden = await app.request("http://localhost/api/v1/psychologists/33333333-3333-4333-8333-333333333333", { headers: { Origin: "http://localhost:3001" } });
    expect(hidden.status).toBe(404);
  });

  test("accepts psychologist profile without valid photo url", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository });

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "optional-photo@example.com", username: "optionalphoto", password: "password123", confirm_password: "password123" }),
    });
    const registerBody = await register.json();
    const token = registerBody.data.session.access_token as string;

    const missingPhoto = await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "clinical", fullName: "Dr. Optional", dateOfBirth: "1990-01-01", address: "Jl. Demo" }),
    });
    expect(missingPhoto.status).toBe(201);
    const missingPhotoBody = await missingPhoto.json();
    expect(missingPhotoBody.data.photoUrl).toBeNull();

    const invalidPhoto = await app.request("http://localhost/api/v1/psychologists/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "clinical", fullName: "Dr. Optional", dateOfBirth: "1990-01-01", address: "Jl. Demo", photoUrl: { url: "https://example.com/photo.jpg" } }),
    });
    expect(invalidPhoto.status).toBe(200);
    const invalidPhotoBody = await invalidPhoto.json();
    expect(invalidPhotoBody.data.photoUrl).toBeNull();
  });

  test("creates bundle, derives package name, and exposes generated sessions", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository });

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "approved@example.com", username: "approved", password: "password123", confirm_password: "password123" }),
    });
    const registerBody = await register.json();
    const token = registerBody.data.session.access_token as string;
    const userId = registerBody.data.user.id as string;

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "clinical", fullName: "Dr. Approved", dateOfBirth: "1990-01-01", address: "Jl. Demo", photoUrl: "https://example.com/photo.jpg" }),
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

    const detailWithAvailability = await app.request(`http://localhost/api/v1/psychologists/${userId}`, { headers: { Origin: "http://localhost:3001" } });
    expect(detailWithAvailability.status).toBe(200);
    const detailWithAvailabilityBody = await detailWithAvailability.json();
    expect(detailWithAvailabilityBody.data.availability).toHaveLength(2);
    expect(detailWithAvailabilityBody.data.availability[0]).toMatchObject({
      date: "2026-02-01",
      totalSlots: 1,
      availableSlots: 1,
      heldSlots: 0,
      bookedSlots: 0,
      completedSlots: 0,
      cancelledSlots: 0,
      expiredSlots: 0,
      rescheduledSlots: 0,
      slots: [{ startsAt: "2026-02-01T08:00:00.000Z", endsAt: "2026-02-01T11:00:00.000Z", status: "available", packageName: "Paket 3 Jam", packageDurationMinutes: 180, priceAmount: 150000 }],
    });
    expect(detailWithAvailabilityBody.data.availability[1]).toMatchObject({
      date: "2026-02-02",
      totalSlots: 1,
      availableSlots: 1,
      slots: [{ startsAt: "2026-02-02T08:00:00.000Z", endsAt: "2026-02-02T11:00:00.000Z", status: "available" }],
    });

    const allSessions = await app.request("http://localhost/api/v1/psychologist-sessions", { headers: { Origin: "http://localhost:3001" } });
    expect(allSessions.status).toBe(200);
    const allSessionsBody = await allSessions.json();
    expect(allSessionsBody.data).toHaveLength(2);
    expect(allSessionsBody.data[0]).toMatchObject({
      status: "available",
      packageName: "Paket 3 Jam",
      priceAmount: 150000,
      psychologist: {
        id: userId,
        fullName: "Dr. Approved",
        type: "clinical",
        consultationChannel: "chat_and_meet",
        latestReviews: [],
      },
    });
  });

  test("creates availability window with multiple session packages", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository });

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "window@example.com", username: "window", password: "password123", confirm_password: "password123" }),
    });
    const registerBody = await register.json();
    const token = registerBody.data.session.access_token as string;
    const userId = registerBody.data.user.id as string;

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "general", fullName: "Dr. Window", dateOfBirth: "1990-01-01", address: "Jl. Demo", photoUrl: "https://example.com/photo.jpg" }),
    });
    await psychologistsRepository.updateApprovalStatus(userId, "approved");

    const create = await app.request("http://localhost/api/v1/psychologists/me/availability-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        dateStart: "2026-02-01",
        dateEnd: "2026-02-01",
        dailyStartTime: "09:00",
        dailyEndTime: "12:00",
        packages: [
          { durationMinutes: 60, priceAmount: 150000 },
          { durationMinutes: 30, priceAmount: 100000 },
        ],
      }),
    });

    expect(create.status).toBe(201);
    const createBody = await create.json();
    expect(createBody.data.bundles).toHaveLength(2);
    expect(createBody.data.bundles.map((bundle: { packageName: string }) => bundle.packageName)).toEqual(["Paket 1 Jam", "Paket 30 Menit"]);
    expect(createBody.data.sessions).toHaveLength(9);

    const sessions = await app.request(`http://localhost/api/v1/psychologists/${userId}/sessions`, { headers: { Origin: "http://localhost:3001" } });
    const sessionsBody = await sessions.json();
    expect(sessionsBody.data).toHaveLength(9);
  });

  test("rejects invalid bundle times, overlap, and ownership mismatch", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const app = createApp(baseEnv, {}, { authRepository, psychologistsRepository });

    const ownerRegister = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "owner@example.com", username: "owner", password: "password123", confirm_password: "password123" }),
    });
    const ownerBody = await ownerRegister.json();
    const ownerToken = ownerBody.data.session.access_token as string;
    const ownerUserId = ownerBody.data.user.id as string;

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ type: "clinical", fullName: "Dr. Owner", dateOfBirth: "1990-01-01", address: "Jl. Demo", photoUrl: "https://example.com/photo.jpg" }),
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
      body: JSON.stringify({ email: "other@example.com", username: "other", password: "password123", confirm_password: "password123" }),
    });
    const otherBody = await otherRegister.json();
    const otherToken = otherBody.data.session.access_token as string;

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${otherToken}` },
      body: JSON.stringify({ type: "clinical", fullName: "Dr. Other", dateOfBirth: "1990-01-01", address: "Jl. Demo", photoUrl: "https://example.com/photo.jpg" }),
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

  test("approves psychologist automatically after all required credentials are uploaded", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const psychologistsRepository = createMemoryPsychologistsRepository();
    const storedKeys: string[] = [];
    const app = createApp(baseEnv, {}, {
      authRepository,
      psychologistsRepository,
      credentialStorage: {
        async put(input) { storedKeys.push(input.key); },
        async getSignedUrl(key) { return `https://storage.example.test/${key}`; },
      },
    });

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "credentials@example.com", username: "credentials", password: "password123", confirm_password: "password123" }),
    });
    const registerBody = await register.json();
    const token = registerBody.data.session.access_token as string;

    await app.request("http://localhost/api/v1/psychologists/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "general", fullName: "Dr. Complete", dateOfBirth: "1990-01-01", address: "Jl. Demo", photoUrl: "https://example.com/photo.jpg" }),
    });

    const upload = async (documentType: CredentialDocumentType) => {
      const form = new FormData();
      form.set("documentType", documentType);
      form.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], `${documentType}.pdf`, { type: "application/pdf" }));
      return app.request("http://localhost/api/v1/psychologists/me/credential-file", {
        method: "POST",
        headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
        body: form,
      });
    };

    expect((await upload("sipp")).status).toBe(201);
    let profile = await app.request("http://localhost/api/v1/psychologists/me", { headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${token}` } });
    expect((await profile.json()).data.approvalStatus).toBe("draft");

    expect((await upload("ijazah")).status).toBe(201);
    expect((await upload("str")).status).toBe(201);

    profile = await app.request("http://localhost/api/v1/psychologists/me", { headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${token}` } });
    expect((await profile.json()).data.approvalStatus).toBe("approved");
    expect(storedKeys).toHaveLength(3);
  });
});
