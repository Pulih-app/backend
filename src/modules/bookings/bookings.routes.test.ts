import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import { buildPakasirPaymentUrl, generateOrderId } from "../payments/pakasir";
import { hashPassword } from "../auth/password";
import type { AuthRepository, AuthUserRecord } from "../auth/auth.repository";
import type { BookingDetailRecord, BookingRecord, BookingsRepository, PaymentRecord, PsychologistAvailabilityDateRecord, SessionSlotBookingRecord } from "./bookings.repository";

const baseEnv = {
  APP_NAME: "pulih-api",
  APP_ENV: "local",
  NODE_ENV: "development",
  PORT: "3002",
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

function toBookingDetail(record: BookingRecord, extra: { patientEmail: string; psychologistEmail: string; psychologistFullName: string }): BookingDetailRecord {
  return { ...record, ...extra, ratingSummary: { averageRating: 0, reviewCount: 0 }, latestReviews: [] };
}

function createMemoryBookingsRepository(seed: {
  sessions?: SessionSlotBookingRecord[];
  bookings?: BookingDetailRecord[];
  payments?: PaymentRecord[];
} = {}): BookingsRepository {
  const sessions = new Map((seed.sessions ?? []).map((session) => [session.id, { ...session }]));
  const bookings = new Map((seed.bookings ?? []).map((booking) => [booking.id, { ...booking }]));
  const payments = new Map((seed.payments ?? []).map((payment) => [payment.id, { ...payment }]));
  const messages: Array<{ id: string; bookingId: string; senderUserId: string; content: string; createdAt: string }> = [];
  const reviews = new Map<string, { id: string; bookingId: string; patientUserId: string; psychologistProfileId: string; rating: number; comment: string | null; createdAt: string; updatedAt: string }>();

  function emptyAvailabilityDate(date: string): PsychologistAvailabilityDateRecord {
    return { date, totalSlots: 0, availableSlots: 0, heldSlots: 0, bookedSlots: 0, completedSlots: 0, cancelledSlots: 0, expiredSlots: 0, rescheduledSlots: 0 };
  }

  const repository: BookingsRepository = {
    async transaction<T>(callback: (repository: BookingsRepository) => Promise<T>) { return callback(repository); },
    async findSessionSlotForBooking(sessionSlotId) { return sessions.get(sessionSlotId) ?? null; },
    async hasLockedOverlappingSession(input) {
      return Array.from(sessions.values()).some((session) => session.profileId === input.profileId && session.id !== input.excludeSessionSlotId && ["held", "booked", "completed"].includes(session.status) && new Date(session.startsAt) < input.endsAt && new Date(session.endsAt) > input.startsAt);
    },
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
        complaint: input.complaint,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        psychologistType: input.psychologistType,
      };
      bookings.set(booking.id, toBookingDetail(booking, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych" }));
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
    async listAvailabilityDatesByPsychologistUserId(userId) {
      const summaries = new Map<string, PsychologistAvailabilityDateRecord>();
      for (const session of sessions.values()) {
        if (session.psychologistUserId !== userId) continue;
        const date = session.sessionDate.slice(0, 10);
        const summary = summaries.get(date) ?? emptyAvailabilityDate(date);
        summary.totalSlots += 1;
        if (session.status === "available") summary.availableSlots += 1;
        if (session.status === "held") summary.heldSlots += 1;
        if (session.status === "booked") summary.bookedSlots += 1;
        if (session.status === "completed") summary.completedSlots += 1;
        if (session.status === "cancelled") summary.cancelledSlots += 1;
        if (session.status === "expired") summary.expiredSlots += 1;
        if (session.status === "rescheduled") summary.rescheduledSlots += 1;
        summaries.set(date, summary);
      }
      return Array.from(summaries.values()).sort((a, b) => a.date.localeCompare(b.date));
    },
    async findPaymentByOrderId(orderId) { return Array.from(payments.values()).find((payment) => payment.orderId === orderId) ?? null; },
    async findPaymentById(paymentId) { return payments.get(paymentId) ?? null; },
    async findPaymentByBookingId(bookingId) { return Array.from(payments.values()).find((payment) => payment.bookingId === bookingId) ?? null; },
    async hasPaymentEvent() { return false; },
    async createPaymentEvent() { return undefined; },
    async markPaymentCompleted(input) {
      const payment = payments.get(input.paymentId);
      if (payment) payments.set(input.paymentId, { ...payment, status: "completed", paymentMethod: input.paymentMethod, completedAt: input.completedAt.toISOString() });
    },
    async markBookingPaymentCompleted(input) {
      const booking = bookings.get(input.bookingId);
      if (booking) bookings.set(input.bookingId, { ...booking, status: "payment_completed" });
    },
    async markBookingConfirmed(input) {
      const booking = bookings.get(input.bookingId);
      if (booking) bookings.set(input.bookingId, { ...booking, status: "confirmed", meetLink: input.meetLink, confirmedAt: input.confirmedAt.toISOString(), rescheduledAt: null, rescheduleReason: null });
    },
    async markBookingCompleted(input) {
      const booking = bookings.get(input.bookingId);
      if (booking) bookings.set(input.bookingId, { ...booking, status: "completed", updatedAt: input.completedAt.toISOString() });
    },
    async markBookingRescheduled(input) {
      const booking = bookings.get(input.bookingId);
      const previousSessionSlotId = booking?.sessionSlotId;
      if (booking) bookings.set(input.bookingId, { ...booking, sessionSlotId: input.sessionSlotId, scheduledStartAt: input.scheduledStartAt.toISOString(), scheduledEndAt: input.scheduledEndAt.toISOString(), consultationChannel: input.consultationChannel, status: "rescheduled", rescheduledAt: input.rescheduledAt.toISOString(), rescheduleReason: input.rescheduleReason, meetLink: null, confirmedAt: null });
      if (previousSessionSlotId) {
        const oldSession = sessions.get(previousSessionSlotId);
        if (oldSession) sessions.set(previousSessionSlotId, { ...oldSession, status: "rescheduled", heldUntil: null });
      }
      const nextSession = sessions.get(input.sessionSlotId);
      if (nextSession) sessions.set(input.sessionSlotId, { ...nextSession, status: "booked", heldUntil: null });
    },
    async markSessionSlotBooked(sessionSlotId) {
      const session = sessions.get(sessionSlotId);
      if (session) sessions.set(sessionSlotId, { ...session, status: "booked", heldUntil: null });
    },
    async markSessionSlotCompleted(sessionSlotId) {
      const session = sessions.get(sessionSlotId);
      if (session) sessions.set(sessionSlotId, { ...session, status: "completed", heldUntil: null });
    },
    async markSessionSlotRescheduled(sessionSlotId) {
      const session = sessions.get(sessionSlotId);
      if (session) sessions.set(sessionSlotId, { ...session, status: "rescheduled", heldUntil: null });
    },
    async listMessagesByBookingId(bookingId) { return messages.filter((message) => message.bookingId === bookingId); },
    async createMessage(input) {
      const message = { id: crypto.randomUUID(), bookingId: input.bookingId, senderUserId: input.senderUserId, content: input.content, createdAt: new Date().toISOString() };
      messages.push(message);
      return message;
    },
    async findReviewByBookingId(bookingId) { return reviews.get(bookingId) ?? null; },
    async createReview(input) {
      const review = { id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      reviews.set(input.bookingId, review);
      return review;
    },
  };

  return repository;
}

describe("payment helpers", () => {
  test("formats order id and payment url", () => {
    const orderId = generateOrderId(new Date("2026-02-01T10:00:00.000Z"));
    expect(orderId).toMatch(/^PLH-20260201T100000-[A-F0-9]{8}$/);

    expect(buildPakasirPaymentUrl({
      paymentBaseUrl: "https://app.pakasir.com",
      projectSlug: "pulih",
      amount: 150000,
      orderId: "PLH-20260201T100000-ABCDEF12",
      redirectUrl: "http://localhost:3001/help/consultation/bookings/success",
    })).toBe("https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T100000-ABCDEF12&redirect=http%3A%2F%2Flocalhost%3A3001%2Fhelp%2Fconsultation%2Fbookings%2Fsuccess");
  });
});

describe("booking routes", () => {
  test("creates booking, payment row, and hides meet link until confirmation", async () => {
    const authRepository = createMemoryAuthRepository([
      { id: "patient-1", email: "patient@example.com", username: null, passwordHash: "hash", role: "patient", status: "active" },
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash: "hash", role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      sessions: [{
        id: "11111111-1111-4111-8111-111111111111",
        bundleId: "22222222-2222-4222-8222-222222222222",
        profileId: "33333333-3333-4333-8333-333333333333",
        psychologistUserId: "psych-1",
        psychologistApprovalStatus: "approved",
        psychologistType: "clinical",
        consultationChannel: "chat_and_meet",
        sessionDate: "2026-02-01T00:00:00.000Z",
        startsAt: "2026-02-01T08:00:00.000Z",
        endsAt: "2026-02-01T11:00:00.000Z",
        status: "available",
        heldUntil: null,
        packageName: "Paket 3 Jam",
        packageDurationMinutes: 180,
        priceAmount: 150000,
      }, {
        id: "99999999-9999-4999-8999-999999999999",
        bundleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        profileId: "33333333-3333-4333-8333-333333333333",
        psychologistUserId: "psych-1",
        psychologistApprovalStatus: "approved",
        psychologistType: "clinical",
        consultationChannel: "chat_and_meet",
        sessionDate: "2026-02-01T00:00:00.000Z",
        startsAt: "2026-02-01T09:00:00.000Z",
        endsAt: "2026-02-01T10:00:00.000Z",
        status: "available",
        heldUntil: null,
        packageName: "Paket 1 Jam",
        packageDurationMinutes: 60,
        priceAmount: 150000,
      }],
    });
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "patient@example.com", password: "whatever" }),
    });
    const loginBody = await login.json();
    expect(login.status).toBe(401);

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient-2@example.com", username: "patient2", password: "password123", confirm_password: "password123" }),
    });
    const registerBody = await register.json();
    const token = registerBody.data.session.access_token as string;

    const create = await app.request("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionSlotId: "11111111-1111-4111-8111-111111111111", complaint: "Sulit tidur dan mudah cemas." }),
    });

    expect(create.status).toBe(201);
    const createBody = await create.json();
    expect(createBody.data.booking.status).toBe("pending_payment");
    expect(createBody.data.booking.complaint).toBe("Sulit tidur dan mudah cemas.");
    expect(createBody.data.booking.meetLink).toBeNull();
    expect(createBody.data.paymentUrl).toContain("https://app.pakasir.com/pay/pulih/150000");
    expect(createBody.data.paymentUrl).toContain("redirect=http%3A%2F%2Flocalhost%3A3001%2Fhelp%2Fconsultation%2Fbookings%2Fsuccess");

    const list = await app.request("http://localhost/api/v1/bookings", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.data).toHaveLength(1);

    const detail = await app.request(`http://localhost/api/v1/bookings/${createBody.data.booking.id}`, {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
    });
    expect(detail.status).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.data.meetLink).toBeNull();
    expect(detailBody.data.ratingSummary).toMatchObject({ averageRating: 0, reviewCount: 0 });
    expect(detailBody.data.latestReviews).toEqual([]);

    const duplicate = await app.request("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionSlotId: "11111111-1111-4111-8111-111111111111", complaint: "Sulit tidur dan mudah cemas." }),
    });
    expect(duplicate.status).toBe(409);

    const overlap = await app.request("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionSlotId: "99999999-9999-4999-8999-999999999999", complaint: "Jam overlap." }),
    });
    expect(overlap.status).toBe(409);
  });

  test("returns empty booking list for patient with no bookings", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const bookingsRepository = createMemoryBookingsRepository();
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "empty-bookings@example.com", username: "emptybookings", password: "password123", confirm_password: "password123" }),
    });
    const token = (await register.json()).data.session.access_token as string;

    const response = await app.request("http://localhost/api/v1/bookings", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
  });

  test("rejects booking for non-approved psychologist slot", async () => {
    const authRepository = createMemoryAuthRepository([]);
    const bookingsRepository = createMemoryBookingsRepository({
      sessions: [{
        id: "11111111-1111-4111-8111-111111111111",
        bundleId: "22222222-2222-4222-8222-222222222222",
        profileId: "33333333-3333-4333-8333-333333333333",
        psychologistUserId: "psych-1",
        psychologistApprovalStatus: "draft",
        psychologistType: "clinical",
        consultationChannel: "chat_and_meet",
        sessionDate: "2026-02-01T00:00:00.000Z",
        startsAt: "2026-02-01T08:00:00.000Z",
        endsAt: "2026-02-01T11:00:00.000Z",
        status: "available",
        heldUntil: null,
        packageName: "Paket 3 Jam",
        packageDurationMinutes: 180,
        priceAmount: 150000,
      }],
    });
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });
    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", username: "patient1", password: "password123", confirm_password: "password123" }),
    });
    const token = (await register.json()).data.session.access_token as string;

    const response = await app.request("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionSlotId: "11111111-1111-4111-8111-111111111111", complaint: "Sulit tidur dan mudah cemas." }),
    });

    expect(response.status).toBe(403);
  });

  test("rejects booking creation by psychologist role", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryAuthRepository([
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash, role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      sessions: [{
        id: "11111111-1111-4111-8111-111111111111",
        bundleId: "22222222-2222-4222-8222-222222222222",
        profileId: "33333333-3333-4333-8333-333333333333",
        psychologistUserId: "psych-1",
        psychologistApprovalStatus: "approved",
        psychologistType: "clinical",
        consultationChannel: "chat_and_meet",
        sessionDate: "2026-02-01T00:00:00.000Z",
        startsAt: "2026-02-01T08:00:00.000Z",
        endsAt: "2026-02-01T11:00:00.000Z",
        status: "available",
        heldUntil: null,
        packageName: "Paket 3 Jam",
        packageDurationMinutes: 180,
        priceAmount: 150000,
      }],
    });
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });
    const token = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "psych@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const response = await app.request("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionSlotId: "11111111-1111-4111-8111-111111111111", complaint: "Sulit tidur dan mudah cemas." }),
    });

    expect(response.status).toBe(403);
  });

  test("enforces owner-only booking access", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryAuthRepository([
      { id: "patient-1", email: "patient@example.com", username: null, passwordHash, role: "patient", status: "active" },
      { id: "patient-2", email: "other@example.com", username: null, passwordHash, role: "patient", status: "active" },
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash, role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      bookings: [
        toBookingDetail({
          id: "44444444-4444-4444-8444-444444444444",
          patientUserId: "patient-1",
          psychologistProfileId: "33333333-3333-4333-8333-333333333333",
          psychologistUserId: "psych-1",
          sessionSlotId: "11111111-1111-4111-8111-111111111111",
          consultationChannel: "chat_and_meet",
          status: "confirmed",
          scheduledStartAt: "2026-02-01T08:00:00.000Z",
          scheduledEndAt: "2026-02-01T11:00:00.000Z",
          priceAmount: 150000,
          packageNameSnapshot: "Paket 3 Jam",
          packageDurationMinutesSnapshot: 180,
          paymentExpiresAt: "2026-02-01T09:00:00.000Z",
          meetLink: "https://meet.google.com/abc-defg-hij",
          confirmedAt: "2026-02-01T07:30:00.000Z",
          rescheduledAt: null,
          rescheduleReason: null,
          complaint: "Sulit tidur dan mudah cemas.",
          createdAt: "2026-02-01T07:00:00.000Z",
          updatedAt: "2026-02-01T07:00:00.000Z",
          psychologistType: "clinical",
        }, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych" }),
      ],
    });
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });

    const patientToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "patient@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const own = await app.request("http://localhost/api/v1/bookings/44444444-4444-4444-8444-444444444444", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${patientToken}` },
    });
    expect(own.status).toBe(200);
    const ownBody = await own.json();
    expect(ownBody.data.meetLink).toBe("https://meet.google.com/abc-defg-hij");

    const otherToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "other@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const forbidden = await app.request("http://localhost/api/v1/bookings/44444444-4444-4444-8444-444444444444", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${otherToken}` },
    });
    expect(forbidden.status).toBe(403);

    const psychToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "psych@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const psychList = await app.request("http://localhost/api/v1/bookings", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
    });
    expect(psychList.status).toBe(200);
    const psychListBody = await psychList.json();
    expect(psychListBody.data).toHaveLength(1);
    expect(psychListBody.data[0].meetLink).toBe("https://meet.google.com/abc-defg-hij");
  });

  test("returns psychologist dashboard availability dates and today's bookings", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const todayJakarta = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const authRepository = createMemoryAuthRepository([
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash, role: "psychologist", status: "active" },
      { id: "patient-1", email: "patient@example.com", username: null, passwordHash, role: "patient", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      sessions: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          bundleId: "bundle-1",
          profileId: "profile-1",
          psychologistUserId: "psych-1",
          psychologistApprovalStatus: "approved",
          psychologistType: "clinical",
          consultationChannel: "chat_and_meet",
          sessionDate: `${todayJakarta}T00:00:00.000Z`,
          startsAt: `${todayJakarta}T08:00:00.000Z`,
          endsAt: `${todayJakarta}T09:00:00.000Z`,
          status: "available",
          heldUntil: null,
          packageName: "Paket 1 Jam",
          packageDurationMinutes: 60,
          priceAmount: 150000,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          bundleId: "bundle-1",
          profileId: "profile-1",
          psychologistUserId: "psych-1",
          psychologistApprovalStatus: "approved",
          psychologistType: "clinical",
          consultationChannel: "chat_and_meet",
          sessionDate: `${todayJakarta}T00:00:00.000Z`,
          startsAt: `${todayJakarta}T10:00:00.000Z`,
          endsAt: `${todayJakarta}T11:00:00.000Z`,
          status: "booked",
          heldUntil: null,
          packageName: "Paket 1 Jam",
          packageDurationMinutes: 60,
          priceAmount: 150000,
        },
      ],
      bookings: [toBookingDetail({
        id: "99999999-9999-4999-8999-999999999999",
        patientUserId: "patient-1",
        psychologistProfileId: "profile-1",
        psychologistUserId: "psych-1",
        sessionSlotId: "22222222-2222-4222-8222-222222222222",
        consultationChannel: "chat_and_meet",
        status: "payment_completed",
        scheduledStartAt: `${todayJakarta}T10:00:00.000Z`,
        scheduledEndAt: `${todayJakarta}T11:00:00.000Z`,
        priceAmount: 150000,
        packageNameSnapshot: "Paket 1 Jam",
        packageDurationMinutesSnapshot: 60,
        paymentExpiresAt: `${todayJakarta}T09:30:00.000Z`,
        meetLink: null,
        confirmedAt: null,
        rescheduledAt: null,
        rescheduleReason: null,
        complaint: "Sulit tidur dan mudah cemas.",
        createdAt: `${todayJakarta}T07:00:00.000Z`,
        updatedAt: `${todayJakarta}T07:00:00.000Z`,
        psychologistType: "clinical",
      }, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych" })],
    });
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });
    const psychToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "psych@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const availability = await app.request("http://localhost/api/v1/psychologists/me/availability", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
    });
    expect(availability.status).toBe(200);
    expect((await availability.json()).data).toEqual([{ date: todayJakarta, totalSlots: 2, availableSlots: 1, heldSlots: 0, bookedSlots: 1, completedSlots: 0, cancelledSlots: 0, expiredSlots: 0, rescheduledSlots: 0 }]);

    const todayBookings = await app.request("http://localhost/api/v1/psychologists/me/bookings/today", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
    });
    expect(todayBookings.status).toBe(200);
    const todayBookingsBody = await todayBookings.json();
    expect(todayBookingsBody.data).toHaveLength(1);
    expect(todayBookingsBody.data[0].id).toBe("99999999-9999-4999-8999-999999999999");
  });

  test("approves booking from psychologist dashboard endpoint", async () => {
    const authRepository = createMemoryAuthRepository([
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash: await hashPassword("password123", 4), role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      bookings: [toBookingDetail({
        id: "55555555-5555-4555-8555-555555555555",
        patientUserId: "patient-1",
        psychologistProfileId: "profile-1",
        psychologistUserId: "psych-1",
        sessionSlotId: "11111111-1111-4111-8111-111111111111",
        consultationChannel: "chat_and_meet",
        status: "payment_completed",
        scheduledStartAt: "2026-02-01T08:00:00.000Z",
        scheduledEndAt: "2026-02-01T09:00:00.000Z",
        priceAmount: 150000,
        packageNameSnapshot: "Paket 1 Jam",
        packageDurationMinutesSnapshot: 60,
        paymentExpiresAt: "2026-02-01T08:30:00.000Z",
        meetLink: null,
        confirmedAt: null,
        rescheduledAt: null,
        rescheduleReason: null,
        complaint: "Sulit tidur dan mudah cemas.",
        createdAt: "2026-02-01T07:00:00.000Z",
        updatedAt: "2026-02-01T07:00:00.000Z",
        psychologistType: "clinical",
      }, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych" })],
    });
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });
    const psychToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "psych@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const response = await app.request("http://localhost/api/v1/psychologists/me/bookings/55555555-5555-4555-8555-555555555555/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
      body: JSON.stringify({ meetLink: "https://meet.google.com/new-session" }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).data.status).toBe("confirmed");
  });

  test("confirms clinical booking and sends email event", async () => {
    const authRepository = createMemoryAuthRepository([
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash: await hashPassword("password123", 4), role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      bookings: [toBookingDetail({
        id: "55555555-5555-4555-8555-555555555555",
        patientUserId: "patient-1",
        psychologistProfileId: "profile-1",
        psychologistUserId: "psych-1",
        sessionSlotId: "11111111-1111-4111-8111-111111111111",
        consultationChannel: "chat_and_meet",
        status: "payment_completed",
        scheduledStartAt: "2026-02-01T08:00:00.000Z",
        scheduledEndAt: "2026-02-01T09:00:00.000Z",
        priceAmount: 150000,
        packageNameSnapshot: "Paket 1 Jam",
        packageDurationMinutesSnapshot: 60,
        paymentExpiresAt: "2026-02-01T08:30:00.000Z",
        meetLink: null,
        confirmedAt: null,
        rescheduledAt: null,
        rescheduleReason: null,
        complaint: "Sulit tidur dan mudah cemas.",
        createdAt: "2026-02-01T07:00:00.000Z",
        updatedAt: "2026-02-01T07:00:00.000Z",
        psychologistType: "clinical",
      }, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych" })],
    });
    const notifications: string[] = [];
    const app = createApp(baseEnv, {}, {
      authRepository,
      bookingsRepository,
      notificationsService: {
        async sendPaymentSuccessPatient() { notifications.push("payment_success_patient"); return { skipped: false, event: null as never }; },
        async sendBookingReceivedPsychologist() { notifications.push("booking_received_psychologist"); return { skipped: false, event: null as never }; },
        async sendBookingConfirmedSessionReady() { notifications.push("booking_confirmed_session_ready"); return { skipped: false, event: null as never }; },
        async sendBookingRescheduled() { notifications.push("booking_rescheduled"); return { skipped: false, event: null as never }; },
      },
    });

    const psychToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "psych@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const response = await app.request("http://localhost/api/v1/bookings/55555555-5555-4555-8555-555555555555/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
      body: JSON.stringify({ meetLink: "https://meet.google.com/new-session" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("confirmed");
    expect(body.data.meetLink).toBe("https://meet.google.com/new-session");
    expect(notifications).toContain("booking_confirmed_session_ready");
  });

  test("rejects non-Google Meet link for clinical confirmation", async () => {
    const authRepository = createMemoryAuthRepository([
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash: await hashPassword("password123", 4), role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      bookings: [toBookingDetail({
        id: "77777777-7777-4777-8777-777777777777",
        patientUserId: "patient-1",
        psychologistProfileId: "profile-1",
        psychologistUserId: "psych-1",
        sessionSlotId: "11111111-1111-4111-8111-111111111111",
        consultationChannel: "chat_and_meet",
        status: "payment_completed",
        scheduledStartAt: "2026-02-01T08:00:00.000Z",
        scheduledEndAt: "2026-02-01T09:00:00.000Z",
        priceAmount: 150000,
        packageNameSnapshot: "Paket 1 Jam",
        packageDurationMinutesSnapshot: 60,
        paymentExpiresAt: "2026-02-01T08:30:00.000Z",
        meetLink: null,
        confirmedAt: null,
        rescheduledAt: null,
        rescheduleReason: null,
        complaint: "Sulit tidur dan mudah cemas.",
        createdAt: "2026-02-01T07:00:00.000Z",
        updatedAt: "2026-02-01T07:00:00.000Z",
        psychologistType: "clinical",
      }, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych" })],
    });
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });
    const psychToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "psych@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const response = await app.request("http://localhost/api/v1/bookings/77777777-7777-4777-8777-777777777777/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
      body: JSON.stringify({ meetLink: "https://evil.example/session" }),
    });

    expect(response.status).toBe(422);
  });

  test("supports booking chat, completion, and one patient review", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryAuthRepository([
      { id: "patient-1", email: "patient@example.com", username: null, passwordHash, role: "patient", status: "active" },
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash, role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      bookings: [toBookingDetail({
        id: "88888888-8888-4888-8888-888888888888",
        patientUserId: "patient-1",
        psychologistProfileId: "profile-1",
        psychologistUserId: "psych-1",
        sessionSlotId: "11111111-1111-4111-8111-111111111111",
        consultationChannel: "chat_and_meet",
        status: "confirmed",
        scheduledStartAt: "2026-02-01T08:00:00.000Z",
        scheduledEndAt: "2026-02-01T09:00:00.000Z",
        priceAmount: 150000,
        packageNameSnapshot: "Paket 1 Jam",
        packageDurationMinutesSnapshot: 60,
        paymentExpiresAt: "2026-02-01T08:30:00.000Z",
        meetLink: "https://meet.google.com/abc-defg-hij",
        confirmedAt: "2026-02-01T07:30:00.000Z",
        rescheduledAt: null,
        rescheduleReason: null,
        complaint: "Sulit tidur dan mudah cemas.",
        createdAt: "2026-02-01T07:00:00.000Z",
        updatedAt: "2026-02-01T07:00:00.000Z",
        psychologistType: "clinical",
      }, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych" })],
    });
    const app = createApp(baseEnv, {}, { authRepository, bookingsRepository });
    const patientToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "patient@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;
    const psychToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "psych@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const message = await app.request("http://localhost/api/v1/bookings/88888888-8888-4888-8888-888888888888/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({ content: "Hello doctor" }),
    });
    expect(message.status).toBe(201);

    const messages = await app.request("http://localhost/api/v1/bookings/88888888-8888-4888-8888-888888888888/messages", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
    });
    expect(messages.status).toBe(200);
    expect((await messages.json()).data).toHaveLength(1);

    const complete = await app.request("http://localhost/api/v1/bookings/88888888-8888-4888-8888-888888888888/complete", {
      method: "POST",
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
    });
    expect(complete.status).toBe(200);
    expect((await complete.json()).data.status).toBe("completed");

    const review = await app.request("http://localhost/api/v1/bookings/88888888-8888-4888-8888-888888888888/review", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({ rating: 5, comment: "Helpful" }),
    });
    expect(review.status).toBe(201);

    const duplicate = await app.request("http://localhost/api/v1/bookings/88888888-8888-4888-8888-888888888888/review", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${patientToken}` },
      body: JSON.stringify({ rating: 4, comment: "Again" }),
    });
    expect(duplicate.status).toBe(409);
  });

  test("reschedules booking and sends email event", async () => {
    const authRepository = createMemoryAuthRepository([
      { id: "psych-1", email: "psych@example.com", username: null, passwordHash: await hashPassword("password123", 4), role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      sessions: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          bundleId: "bundle-1",
          profileId: "profile-1",
          psychologistUserId: "psych-1",
          psychologistApprovalStatus: "approved",
          psychologistType: "clinical",
          consultationChannel: "chat_and_meet",
          sessionDate: "2026-02-01T00:00:00.000Z",
          startsAt: "2026-02-01T08:00:00.000Z",
          endsAt: "2026-02-01T09:00:00.000Z",
          status: "booked",
          heldUntil: null,
          packageName: "Paket 1 Jam",
          packageDurationMinutes: 60,
          priceAmount: 150000,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          bundleId: "bundle-1",
          profileId: "profile-1",
          psychologistUserId: "psych-1",
          psychologistApprovalStatus: "approved",
          psychologistType: "clinical",
          consultationChannel: "chat_and_meet",
          sessionDate: "2026-02-02T00:00:00.000Z",
          startsAt: "2026-02-02T08:00:00.000Z",
          endsAt: "2026-02-02T09:00:00.000Z",
          status: "available",
          heldUntil: null,
          packageName: "Paket 1 Jam",
          packageDurationMinutes: 60,
          priceAmount: 150000,
        },
      ],
      bookings: [toBookingDetail({
        id: "66666666-6666-4666-8666-666666666666",
        patientUserId: "patient-1",
        psychologistProfileId: "profile-1",
        psychologistUserId: "psych-1",
        sessionSlotId: "11111111-1111-4111-8111-111111111111",
        consultationChannel: "chat_and_meet",
        status: "confirmed",
        scheduledStartAt: "2026-02-01T08:00:00.000Z",
        scheduledEndAt: "2026-02-01T09:00:00.000Z",
        priceAmount: 150000,
        packageNameSnapshot: "Paket 1 Jam",
        packageDurationMinutesSnapshot: 60,
        paymentExpiresAt: "2026-02-01T08:30:00.000Z",
        meetLink: "https://meet.google.com/abc-defg-hij",
        confirmedAt: "2026-02-01T07:30:00.000Z",
        rescheduledAt: null,
        rescheduleReason: null,
        complaint: "Sulit tidur dan mudah cemas.",
        createdAt: "2026-02-01T07:00:00.000Z",
        updatedAt: "2026-02-01T07:00:00.000Z",
        psychologistType: "clinical",
      }, { patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych" })],
    });
    const notifications: string[] = [];
    const app = createApp(baseEnv, {}, {
      authRepository,
      bookingsRepository,
      notificationsService: {
        async sendPaymentSuccessPatient() { notifications.push("payment_success_patient"); return { skipped: false, event: null as never }; },
        async sendBookingReceivedPsychologist() { notifications.push("booking_received_psychologist"); return { skipped: false, event: null as never }; },
        async sendBookingConfirmedSessionReady() { notifications.push("booking_confirmed_session_ready"); return { skipped: false, event: null as never }; },
        async sendBookingRescheduled() { notifications.push("booking_rescheduled"); return { skipped: false, event: null as never }; },
      },
    });

    const psychToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ identifier: "psych@example.com", password: "password123" }),
    })).json()).data.session.access_token as string;

    const response = await app.request("http://localhost/api/v1/bookings/66666666-6666-4666-8666-666666666666/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
      body: JSON.stringify({ newSessionSlotId: "22222222-2222-4222-8222-222222222222", reason: "Schedule conflict" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("rescheduled");
    expect(body.data.sessionSlotId).toBe("22222222-2222-4222-8222-222222222222");
    expect(notifications).toContain("booking_rescheduled");
  });
});
