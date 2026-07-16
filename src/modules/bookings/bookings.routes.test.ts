import { describe, expect, test } from "bun:test";
import { createApp } from "../../app";
import { buildPakasirPaymentUrl, generateOrderId } from "../payments/pakasir";
import { hashPassword } from "../auth/password";
import type { AuthRepository, AuthUserRecord } from "../auth/auth.repository";
import type { BookingDetailRecord, BookingRecord, BookingsRepository, PaymentRecord, SessionSlotBookingRecord } from "./bookings.repository";

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

  const repository: BookingsRepository = {
    async transaction<T>(callback: (repository: BookingsRepository) => Promise<T>) { return callback(repository); },
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
    })).toBe("https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T100000-ABCDEF12");
  });
});

describe("booking routes", () => {
  test("creates booking, payment row, and hides meet link until confirmation", async () => {
    const authRepository = createMemoryAuthRepository([
      { id: "patient-1", email: "patient@example.com", passwordHash: "hash", role: "patient", status: "active" },
      { id: "psych-1", email: "psych@example.com", passwordHash: "hash", role: "psychologist", status: "active" },
    ]);
    const bookingsRepository = createMemoryBookingsRepository({
      sessions: [{
        id: "11111111-1111-4111-8111-111111111111",
        bundleId: "22222222-2222-4222-8222-222222222222",
        profileId: "33333333-3333-4333-8333-333333333333",
        psychologistUserId: "psych-1",
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

    const login = await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient@example.com", password: "whatever" }),
    });
    const loginBody = await login.json();
    expect(login.status).toBe(401);

    const register = await app.request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "patient-2@example.com", password: "password123" }),
    });
    const registerBody = await register.json();
    const token = registerBody.data.accessToken as string;

    const create = await app.request("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionSlotId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(create.status).toBe(201);
    const createBody = await create.json();
    expect(createBody.data.booking.status).toBe("pending_payment");
    expect(createBody.data.booking.meetLink).toBeNull();
    expect(createBody.data.paymentUrl).toContain("https://app.pakasir.com/pay/pulih/150000");

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

    const duplicate = await app.request("http://localhost/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionSlotId: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(duplicate.status).toBe(409);
  });

  test("enforces owner-only booking access", async () => {
    const passwordHash = await hashPassword("password123", 4);
    const authRepository = createMemoryAuthRepository([
      { id: "patient-1", email: "patient@example.com", passwordHash, role: "patient", status: "active" },
      { id: "patient-2", email: "other@example.com", passwordHash, role: "patient", status: "active" },
      { id: "psych-1", email: "psych@example.com", passwordHash, role: "psychologist", status: "active" },
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
          meetLink: "https://meet.example/session",
          confirmedAt: "2026-02-01T07:30:00.000Z",
          rescheduledAt: null,
          rescheduleReason: null,
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
      body: JSON.stringify({ email: "patient@example.com", password: "password123" }),
    })).json()).data.accessToken as string;

    const own = await app.request("http://localhost/api/v1/bookings/44444444-4444-4444-8444-444444444444", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${patientToken}` },
    });
    expect(own.status).toBe(200);
    const ownBody = await own.json();
    expect(ownBody.data.meetLink).toBe("https://meet.example/session");

    const otherToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "other@example.com", password: "password123" }),
    })).json()).data.accessToken as string;

    const forbidden = await app.request("http://localhost/api/v1/bookings/44444444-4444-4444-8444-444444444444", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${otherToken}` },
    });
    expect(forbidden.status).toBe(403);

    const psychToken = (await (await app.request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ email: "psych@example.com", password: "password123" }),
    })).json()).data.accessToken as string;

    const psychList = await app.request("http://localhost/api/v1/bookings", {
      headers: { Origin: "http://localhost:3001", Authorization: `Bearer ${psychToken}` },
    });
    expect(psychList.status).toBe(200);
    const psychListBody = await psychList.json();
    expect(psychListBody.data).toHaveLength(1);
    expect(psychListBody.data[0].meetLink).toBe("https://meet.example/session");
  });
});
