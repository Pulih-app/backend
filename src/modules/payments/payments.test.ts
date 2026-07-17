import { describe, expect, test } from "bun:test";
import type { BookingsRepository, BookingDetailRecord, PaymentRecord } from "../bookings/bookings.repository";
import { createPakasirClient, type PakasirTransactionDetail } from "./pakasir";
import { pakasirWebhookSchema } from "./payments.schema";
import { createPaymentsService } from "./payments.service";

const config = {
  app: { appName: "pulih-api", appEnv: "local", nodeEnv: "test", port: 3000, apiPrefix: "/api/v1", appUrl: "http://localhost:3000", pwaUrl: "http://localhost:3001" },
  database: { databaseUrl: "postgresql://localhost/test", directDatabaseUrl: "postgresql://localhost/test", poolMax: 10, poolIdleTimeoutMs: 30000 },
  security: { jwtAccessSecret: "secret", jwtAccessTtlSeconds: 86400, passwordHashCost: 4, corsAllowedOrigins: ["http://localhost:3001"], requestIdHeader: "x-request-id" },
  payment: { pakasirProjectSlug: "pulih", pakasirBaseUrl: "https://app.pakasir.com", pakasirPaymentBaseUrl: "https://app.pakasir.com", pakasirApiKey: "test-key", pakasirProviderTimeoutMs: 1000 },
  email: { resendApiKey: "test-resend-key", resendFromEmail: "no-reply@salmanabdurrahman.web.id", resendFromName: "Pulih" },
};

function createRepository(seed: { payment: PaymentRecord; booking: BookingDetailRecord }) {
  const payment = { ...seed.payment };
  const booking = { ...seed.booking };
  const events: Array<{ eventType: string; providerStatus: string; orderId: string; amount: number }> = [];
  const repository: BookingsRepository = {
    async transaction(callback) { return callback(repository); },
    async findSessionSlotForBooking() { return null; },
    async claimSessionSlot() { return null; },
    async createBooking() { throw new Error("not used"); },
    async createBookingStatusEvent() { return undefined; },
    async createPayment() { return payment; },
    async findBookingById(id) { return id === booking.id ? booking : null; },
    async listBookingsByPatientUserId() { return []; },
    async listBookingsByPsychologistUserId() { return []; },
    async listAvailabilityDatesByPsychologistUserId() { return []; },
    async findPaymentByOrderId(orderId) { return orderId === payment.orderId ? payment : null; },
    async findPaymentById(paymentId) { return paymentId === payment.id ? payment : null; },
    async findPaymentByBookingId(bookingId) { return bookingId === booking.id ? payment : null; },
    async hasPaymentEvent(input) { return events.some((event) => event.eventType === input.eventType && event.providerStatus === input.providerStatus && event.orderId === input.orderId && event.amount === input.amount); },
    async createPaymentEvent(input) { events.push(input); },
    async markPaymentCompleted(input) { payment.status = "completed"; payment.paymentMethod = input.paymentMethod; payment.completedAt = input.completedAt.toISOString(); },
    async markBookingPaymentCompleted() { booking.status = "payment_completed"; },
    async markBookingConfirmed(input) { booking.status = "confirmed"; booking.meetLink = input.meetLink; booking.confirmedAt = input.confirmedAt.toISOString(); },
    async markBookingRescheduled() { booking.status = "rescheduled"; },
    async markBookingCompleted() { booking.status = "completed"; },
    async markSessionSlotBooked() { return undefined; },
    async markSessionSlotCompleted() { return undefined; },
    async markSessionSlotRescheduled() { return undefined; },
    async listMessagesByBookingId() { return []; },
    async createMessage() { throw new Error("not used"); },
    async findReviewByBookingId() { return null; },
    async createReview() { throw new Error("not used"); },
  };
  return { repository, payment, booking, events };
}

function seedRecords() {
  const booking: BookingDetailRecord = {
    id: "booking-1",
    patientUserId: "patient-1",
    psychologistProfileId: "profile-1",
    psychologistUserId: "psych-1",
    sessionSlotId: "slot-1",
    consultationChannel: "chat",
    status: "pending_payment",
    scheduledStartAt: "2026-02-01T08:00:00.000Z",
    scheduledEndAt: "2026-02-01T09:00:00.000Z",
    priceAmount: 150000,
    packageNameSnapshot: "Paket 1 Jam",
    packageDurationMinutesSnapshot: 60,
    paymentExpiresAt: "2099-02-01T08:30:00.000Z",
    meetLink: null,
    confirmedAt: null,
    rescheduledAt: null,
    rescheduleReason: null,
    complaint: "Sulit tidur dan mudah cemas.",
    createdAt: "2026-02-01T07:00:00.000Z",
    updatedAt: "2026-02-01T07:00:00.000Z",
    psychologistType: "general",
    patientEmail: "patient@example.com",
    psychologistEmail: "psych@example.com",
    psychologistFullName: "Dr. Psych",
    ratingSummary: { averageRating: 0, reviewCount: 0 },
    latestReviews: [],
  };
  const payment: PaymentRecord = {
    id: "payment-1",
    bookingId: booking.id,
    provider: "pakasir",
    orderId: "PLH-20260201T070000-ABCDEF12",
    amount: 150000,
    status: "created",
    paymentMethod: null,
    paymentUrl: "https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T070000-ABCDEF12",
    completedAt: null,
    expiresAt: "2099-02-01T08:30:00.000Z",
    providerMetadata: {},
    createdAt: "2026-02-01T07:00:00.000Z",
    updatedAt: "2026-02-01T07:00:00.000Z",
  };
  return { booking, payment };
}

describe("Pakasir client", () => {
  test("maps transaction detail response", async () => {
    const client = createPakasirClient({
      baseUrl: "https://app.pakasir.com",
      apiKey: "secret-key",
      timeoutMs: 1000,
      fetcher: (async (url) => {
        expect(String(url)).toContain("/api/transactiondetail");
        expect(String(url)).toContain("api_key=secret-key");
        return Response.json({ transaction: { project: "pulih", order_id: "ORDER-1", amount: 150000, status: "completed", payment_method: "qris", completed_at: "2026-02-01T08:00:00+07:00" } });
      }) as typeof fetch,
    });

    await expect(client.getTransactionDetail({ project: "pulih", orderId: "ORDER-1", amount: 150000 })).resolves.toEqual({
      project: "pulih",
      orderId: "ORDER-1",
      amount: 150000,
      status: "completed",
      paymentMethod: "qris",
      completedAt: "2026-02-01T08:00:00+07:00",
    } satisfies PakasirTransactionDetail);
  });
});

describe("payment webhook schema", () => {
  test("accepts Pakasir sandbox webhook payload with high-precision timestamp", () => {
    const result = pakasirWebhookSchema({
      amount: 150000,
      order_id: "PLH-20260717T081352-8A4882CD",
      project: "pulih",
      status: "completed",
      payment_method: "qris",
      completed_at: "2026-07-17T08:14:29.250559848Z",
      is_sandbox: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.completedAt).toBe("2026-07-17T08:14:29.250Z");
      expect(result.value.isSandbox).toBe(true);
    }
  });
});

describe("payment service", () => {
  test("returns owner-only safe payment status", async () => {
    const { booking, payment } = seedRecords();
    const state = createRepository({ booking, payment });
    const service = createPaymentsService({ repository: state.repository, config, pakasirClient: { async getTransactionDetail() { throw new Error("not used"); }, async simulatePayment() { return undefined; } } });

    const status = await service.getPaymentStatus("patient-1", "patient", payment.id);
    expect(status).toMatchObject({ id: payment.id, status: "created" });
    expect(status).not.toHaveProperty("providerMetadata");
    await expect(service.getPaymentStatus("other", "patient", payment.id)).rejects.toThrow("own payment status");
  });

  test("processes completed webhook idempotently", async () => {
    const { booking, payment } = seedRecords();
    const state = createRepository({ booking, payment });
    const service = createPaymentsService({
      repository: state.repository,
      config,
      pakasirClient: {
        async getTransactionDetail() { return { project: "pulih", orderId: payment.orderId, amount: payment.amount, status: "completed", paymentMethod: "qris", completedAt: "2026-02-01T08:00:00+07:00" }; },
        async simulatePayment() { return undefined; },
      },
    });

    const payload = { project: "pulih", orderId: payment.orderId, amount: 150000, status: "completed", paymentMethod: "qris", completedAt: "2026-02-01T08:00:00+07:00" };
    const first = await service.processPakasirWebhook(payload);
    const second = await service.processPakasirWebhook(payload);

    expect(first).toMatchObject({ status: "completed", idempotent: false });
    expect(second).toMatchObject({ status: "completed", idempotent: true });
    expect(state.payment.status).toBe("completed");
    expect(state.booking.status).toBe("payment_completed");
    expect(state.events).toHaveLength(1);
  });

  test("rejects completed webhook after booking payment expiry without mutation", async () => {
    const { booking, payment } = seedRecords();
    booking.paymentExpiresAt = "2020-02-01T08:30:00.000Z";
    const state = createRepository({ booking, payment });
    const service = createPaymentsService({
      repository: state.repository,
      config,
      pakasirClient: {
        async getTransactionDetail() { throw new Error("should not call provider for expired payment"); },
        async simulatePayment() { return undefined; },
      },
    });

    await expect(service.processPakasirWebhook({ project: "pulih", orderId: payment.orderId, amount: 150000, status: "completed", paymentMethod: "qris", completedAt: null })).rejects.toThrow("Payment has expired");
    expect(state.payment.status).toBe("created");
    expect(state.booking.status).toBe("pending_payment");
    expect(state.events).toHaveLength(0);
  });

  test("rejects webhook amount mismatch", async () => {
    const { booking, payment } = seedRecords();
    const state = createRepository({ booking, payment });
    const service = createPaymentsService({ repository: state.repository, config, pakasirClient: { async getTransactionDetail() { throw new Error("should not call provider"); }, async simulatePayment() { return undefined; } } });

    await expect(service.processPakasirWebhook({ project: "pulih", orderId: payment.orderId, amount: 140000, status: "completed", paymentMethod: "qris", completedAt: null })).rejects.toThrow("Request validation failed.");
  });
});
