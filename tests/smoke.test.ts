import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { AuthRepository, AuthUserRecord } from "../src/modules/auth/auth.repository";
import type { UsersRepository, UserProfileRecord } from "../src/modules/users/users.repository";
import type { PsychologistsRepository, PsychologistProfileRecord, PsychologistSessionRecord, PsychologistBundleRecord } from "../src/modules/psychologists/psychologists.repository";
import type { CredentialDocumentType } from "../src/modules/psychologists/psychologists.types";
import type { BookingsRepository, BookingDetailRecord, BookingRecord, PaymentRecord, SessionSlotBookingRecord } from "../src/modules/bookings/bookings.repository";
import type { NotificationsService } from "../src/modules/notifications/notifications.service";

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
  PAKASIR_API_KEY: "test-pakasir-key",
  PAKASIR_PROVIDER_TIMEOUT_MS: "1000",
  RESEND_API_KEY: "test-resend-key",
} as const;

function createMemoryAuthRepository(seed: AuthUserRecord[] = []): AuthRepository {
  const users = new Map(seed.map((user) => [user.id, user]));

  return {
    async createUser(input) {
      const user: AuthUserRecord = {
        id: crypto.randomUUID(),
        email: input.email,
        username: input.username,
        passwordHash: input.passwordHash,
        role: input.role,
        status: "active",
      };
      users.set(user.id, user);
      return user;
    },
    async createPatient(input) {
      return this.createUser({ ...input, role: "patient" });
    },
    async findByEmail(email) {
      return Array.from(users.values()).find((user) => user.email === email) ?? null;
    },
    async findByUsername(username) {
      return Array.from(users.values()).find((user) => user.username === username) ?? null;
    },
    async findByLoginIdentifier(identifier) {
      return Array.from(users.values()).find((user) => user.email === identifier || user.username === identifier) ?? null;
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
      username: null,
      nickname: null,
      recoveryReason: null,
      dailyCheckinTime: null,
      pornFreeGoal: null,
      answers: {},
      dependencyLevel: null,
      aiSummary: null,
      onboardingCompletedAt: null,
    };
  }

  function applyUpdate(userId: string, input: Parameters<UsersRepository["updateSettings"]>[1], onboardingCompletedAt?: Date | null) {
    const existing = baseProfile(userId);
    const updated: UserProfileRecord = {
      ...existing,
      nickname: input.nickname !== undefined ? input.nickname : existing.nickname,
      recoveryReason: input.recovery_reason !== undefined ? input.recovery_reason : existing.recoveryReason,
      dailyCheckinTime: input.daily_checkin_time !== undefined ? input.daily_checkin_time : existing.dailyCheckinTime,
      pornFreeGoal: input.porn_free_goal !== undefined ? input.porn_free_goal : existing.pornFreeGoal,
      onboardingCompletedAt: onboardingCompletedAt ?? existing.onboardingCompletedAt,
    };
    profiles.set(userId, updated);
    return updated;
  }

  return {
    async findCurrentUser(userId) {
      return baseProfile(userId);
    },
    async updateSettings(userId, input) {
      return applyUpdate(userId, input);
    },
    async completeOnboarding(userId, input) {
      return applyUpdate(userId, input, new Date("2026-02-01T00:00:00.000Z"));
    },
  };
}

function createMemoryPsychologistsRepository(seed: PsychologistProfileRecord[] = []): PsychologistsRepository {
  const profiles = new Map(seed.map((profile) => [profile.userId, profile]));
  const profilesById = new Map(seed.map((profile) => [profile.id, profile]));
  const sessions = new Map<string, PsychologistSessionRecord[]>();
  const bundles = new Map<string, PsychologistBundleRecord>();
  const files = new Map<string, Array<{ id: string; profileId: string; documentType: CredentialDocumentType; objectKey: string; fileName: string; contentType: string; sizeBytes: number }>>();

  const cloneProfile = (profile: PsychologistProfileRecord): PsychologistProfileRecord => ({
    ...profile,
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
        approvalStatus: existing?.approvalStatus ?? "approved",
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth,
        address: input.address,
        photoUrl: input.photoUrl,
        bio: input.bio,
        ratingSummary: existing?.ratingSummary ?? { averageRating: 4.9, reviewCount: 12 },
        latestBundle: existing?.latestBundle ?? null,
      };
      profiles.set(input.userId, profile);
      profilesById.set(profile.id, profile);
      return cloneProfile(profile);
    },
    async findByUserId(userId) {
      const profile = profiles.get(userId);
      return profile ? cloneProfile(profile) : null;
    },
    async findApprovedById(psychologistId) {
      const profile = profilesById.get(psychologistId);
      return profile?.approvalStatus === "approved" ? cloneProfile(profile) : null;
    },
    async listApproved() {
      return Array.from(profiles.values()).filter((profile) => profile.approvalStatus === "approved").map(cloneProfile);
    },
    async createCredentialFile(input) {
      const file = { id: crypto.randomUUID(), ...input };
      const list = files.get(input.profileId) ?? [];
      list.push(file);
      files.set(input.profileId, list);
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
      const profile = profilesById.get(profileId);
      if (!profile) return;
      const updated = { ...profile, approvalStatus: status };
      profilesById.set(profileId, updated);
      profiles.set(updated.userId, updated);
    },
    async listBundles(profileId) {
      return Array.from(bundles.values()).filter((bundle) => bundle.profileId === profileId).map((bundle) => ({ ...bundle }));
    },
    async findBundleById(bundleId) {
      const bundle = bundles.get(bundleId);
      return bundle ? { ...bundle } : null;
    },
    async createBundleWithSessions(input) {
      const bundle: PsychologistBundleRecord = {
        id: crypto.randomUUID(),
        profileId: input.profileId,
        packageName: input.packageName,
        packageDurationMinutes: input.packageDurationMinutes,
        priceAmount: input.priceAmount,
        dateStart: input.dateStart,
        dateEnd: input.dateEnd,
        dailyStartTime: input.dailyStartTime,
        dailyEndTime: input.dailyEndTime,
      };
      bundles.set(bundle.id, bundle);
      sessions.set(bundle.id, input.sessions.map((session) => ({ id: crypto.randomUUID(), bundleId: bundle.id, profileId: input.profileId, ...session, packageName: input.packageName, packageDurationMinutes: input.packageDurationMinutes, priceAmount: input.priceAmount })));
      return { ...bundle };
    },
    async updateBundleWithSessions(bundleId, input) {
      const existing = bundles.get(bundleId);
      if (!existing) return null;
      const updated = { ...existing, packageName: input.packageName, packageDurationMinutes: input.packageDurationMinutes, priceAmount: input.priceAmount, dateStart: input.dateStart, dateEnd: input.dateEnd, dailyStartTime: input.dailyStartTime, dailyEndTime: input.dailyEndTime };
      bundles.set(bundleId, updated);
      sessions.set(bundleId, input.sessions.map((session) => ({ id: crypto.randomUUID(), bundleId, profileId: existing.profileId, ...session, packageName: input.packageName, packageDurationMinutes: input.packageDurationMinutes, priceAmount: input.priceAmount })));
      return { ...updated };
    },
    async deleteBundle(bundleId) {
      return bundles.delete(bundleId);
    },
    async deleteSessionsByBundleId(bundleId) {
      sessions.delete(bundleId);
    },
    async listSessionsByPsychologistId(psychologistId) {
      return Array.from(sessions.values()).flat().filter((session) => session.profileId === psychologistId).map((session) => ({ ...session }));
    },
    async listSessionsByBundleIds(bundleIds) {
      return bundleIds.flatMap((bundleId) => sessions.get(bundleId) ?? []).map((session) => ({ ...session }));
    },
  };
}

function toBookingDetail(record: BookingRecord, extra: { patientEmail: string; psychologistEmail: string; psychologistFullName: string }): BookingDetailRecord {
  return { ...record, ...extra };
}

function createMemoryBookingsRepository(seed: {
  sessions?: SessionSlotBookingRecord[];
  bookings?: BookingDetailRecord[];
  payments?: PaymentRecord[];
} = {}): BookingsRepository {
  const sessions = new Map((seed.sessions ?? []).map((session) => [session.id, { ...session }]));
  const bookings = new Map((seed.bookings ?? []).map((booking) => [booking.id, { ...booking }]));
  const payments = new Map((seed.payments ?? []).map((payment) => [payment.id, { ...payment }]));
  const events: Array<{ paymentId: string; eventType: string; providerStatus: string; orderId: string; amount: number }> = [];

  const repository: BookingsRepository = {
    async transaction(callback) { return callback(repository); },
    async findSessionSlotForBooking(sessionSlotId) { return sessions.get(sessionSlotId) ?? null; },
    async claimSessionSlot(sessionSlotId, heldUntil) {
      const session = sessions.get(sessionSlotId);
      if (!session || session.status !== "available") return null;
      const updated = { ...session, status: "held" as const, heldUntil: heldUntil.toISOString() };
      sessions.set(sessionSlotId, updated);
      return updated;
    },
    async createBooking(input) {
      const booking: BookingRecord = {
        id: crypto.randomUUID(),
        patientUserId: input.patientUserId,
        psychologistProfileId: input.psychologistProfileId,
        psychologistUserId: input.psychologistUserId,
        sessionSlotId: input.sessionSlotId,
        consultationChannel: input.consultationChannel,
        status: input.status,
        scheduledStartAt: input.scheduledStartAt.toISOString(),
        scheduledEndAt: input.scheduledEndAt.toISOString(),
        priceAmount: input.priceAmount,
        packageNameSnapshot: input.packageNameSnapshot,
        packageDurationMinutesSnapshot: input.packageDurationMinutesSnapshot,
        paymentExpiresAt: input.paymentExpiresAt.toISOString(),
        meetLink: input.meetLink,
        confirmedAt: input.confirmedAt ? input.confirmedAt.toISOString() : null,
        rescheduledAt: input.rescheduledAt ? input.rescheduledAt.toISOString() : null,
        rescheduleReason: input.rescheduleReason ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        psychologistType: input.psychologistType,
      };
      bookings.set(booking.id, toBookingDetail(booking, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Approved" }));
      return booking;
    },
    async createBookingStatusEvent() { return undefined; },
    async createPayment(input) {
      const payment: PaymentRecord = {
        id: crypto.randomUUID(),
        bookingId: input.bookingId,
        provider: input.provider,
        orderId: input.orderId,
        amount: input.amount,
        status: input.status,
        paymentMethod: input.paymentMethod ?? null,
        paymentUrl: input.paymentUrl ?? null,
        completedAt: null,
        expiresAt: input.expiresAt.toISOString(),
        providerMetadata: input.providerMetadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      payments.set(payment.id, payment);
      return payment;
    },
    async findBookingById(bookingId) { return bookings.get(bookingId) ?? null; },
    async listBookingsByPatientUserId(userId) { return Array.from(bookings.values()).filter((booking) => booking.patientUserId === userId); },
    async listBookingsByPsychologistUserId(userId) { return Array.from(bookings.values()).filter((booking) => booking.psychologistUserId === userId); },
    async findPaymentByOrderId(orderId) { return Array.from(payments.values()).find((payment) => payment.orderId === orderId) ?? null; },
    async hasPaymentEvent(input) { return events.some((event) => event.paymentId === input.paymentId && event.eventType === input.eventType && event.providerStatus === input.providerStatus && event.orderId === input.orderId && event.amount === input.amount); },
    async createPaymentEvent(input) { events.push(input); },
    async markPaymentCompleted(input) {
      const payment = payments.get(input.paymentId);
      if (payment) payments.set(input.paymentId, { ...payment, status: "completed", paymentMethod: input.paymentMethod, completedAt: input.completedAt.toISOString() });
    },
    async markBookingPaymentCompleted(input) {
      const booking = bookings.get(input.bookingId);
      if (booking) bookings.set(input.bookingId, { ...booking, status: "payment_completed" });
    },
    async markBookingConfirmed() { return undefined; },
    async markBookingRescheduled() { return undefined; },
    async markSessionSlotBooked(sessionSlotId) {
      const session = sessions.get(sessionSlotId);
      if (session) sessions.set(sessionSlotId, { ...session, status: "booked", heldUntil: null });
    },
    async markSessionSlotRescheduled() { return undefined; },
  };

  return repository;
}

function createNoopNotificationsService(): NotificationsService {
  return {
    async sendPaymentSuccessPatient() { return { event: null as never, skipped: true }; },
    async sendBookingReceivedPsychologist() { return { event: null as never, skipped: true }; },
    async sendBookingConfirmedSessionReady() { return { event: null as never, skipped: true }; },
    async sendBookingRescheduled() { return { event: null as never, skipped: true }; },
  };
}

describe("smoke path", () => {
  test("covers live, ready, auth, profile, directory, booking, and payment status", async () => {
    const authRepository = createMemoryAuthRepository();
    const usersRepository = createMemoryUsersRepository();
    const psychologistsRepository = createMemoryPsychologistsRepository([
      {
        id: "psych-profile-1",
        userId: "psych-user-1",
        type: "clinical",
        consultationChannel: "chat_and_meet",
        approvalStatus: "approved",
        fullName: "Dr. Approved",
        dateOfBirth: "1990-01-01",
        address: "Jl. Demo",
        photoUrl: "https://example.com/photo.jpg",
        bio: "Bio",
        ratingSummary: { averageRating: 4.9, reviewCount: 12 },
        latestBundle: null,
      },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      sessions: [{
        id: "11111111-1111-4111-8111-111111111111",
        bundleId: "bundle-1",
        profileId: "psych-profile-1",
        psychologistUserId: "psych-user-1",
        psychologistApprovalStatus: "approved",
        psychologistType: "clinical",
        consultationChannel: "chat_and_meet",
        sessionDate: "2026-02-01T00:00:00.000Z",
        startsAt: "2026-02-01T08:00:00.000Z",
        endsAt: "2026-02-01T09:00:00.000Z",
        status: "available",
        heldUntil: null,
        packageName: "Paket 1 Jam",
        packageDurationMinutes: 60,
        priceAmount: 150000,
      }],
      bookings: [],
    });

    const app = createApp(baseEnv, {}, {
      databaseHealthCheck: async () => undefined,
      authRepository,
      usersRepository,
      psychologistsRepository,
      bookingsRepository,
      notificationsService: createNoopNotificationsService(),
    });

    const live = await app.request("http://localhost/health/live");
    expect(live.status).toBe(200);

    const ready = await app.request("http://localhost/health/ready");
    expect(ready.status).toBe(200);

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", username: "patient1", password: "password123", confirm_password: "password123" }),
    });
    expect(register.status).toBe(201);
    const registerBody = await register.json();
    const token = registerBody.data.session.access_token as string;

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "patient@example.com", password: "password123" }),
    });
    expect(login.status).toBe(200);

    const profile = await app.request("http://localhost/api/v1/users/me", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
    });
    expect(profile.status).toBe(200);

    const directory = await app.request("http://localhost/api/v1/psychologists", {
      headers: { Origin: "http://localhost:3001" },
    });
    expect(directory.status).toBe(200);
    const directoryBody = await directory.json();
    expect(directoryBody.data).toHaveLength(1);

    const booking = await app.request("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionSlotId: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(booking.status).toBe(201);
    const bookingBody = await booking.json();
    expect(bookingBody.data.booking.status).toBe("pending_payment");
    expect(bookingBody.data.payment.status).toBe("created");
    expect(bookingBody.data.paymentUrl).toContain("order_id=");

    const bookingDetail = await app.request(`http://localhost/api/v1/bookings/${bookingBody.data.booking.id}`, {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
    });
    expect(bookingDetail.status).toBe(200);
    const bookingDetailBody = await bookingDetail.json();
    expect(bookingDetailBody.data.status).toBe("pending_payment");
  });
});
