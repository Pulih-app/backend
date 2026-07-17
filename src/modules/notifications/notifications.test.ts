import { describe, expect, test } from "bun:test";
import type { BookingDetailRecord } from "../bookings/bookings.repository";
import type { NotificationsRepository } from "./notifications.repository";
import { createNotificationsService } from "./notifications.service";
import { renderBookingConfirmedSessionReadyTemplate, renderBookingReceivedPsychologistTemplate, renderBookingRescheduledTemplate, renderPaymentSuccessPatientTemplate } from "./resend";

const config = {
  app: { appName: "pulih-api", appEnv: "local", nodeEnv: "test", port: 3000, apiPrefix: "/api/v1", appUrl: "http://localhost:3000", pwaUrl: "http://localhost:3001" },
  database: { databaseUrl: "postgresql://localhost/test", directDatabaseUrl: "postgresql://localhost/test", poolMax: 10, poolIdleTimeoutMs: 30000 },
  security: { jwtAccessSecret: "secret", jwtAccessTtlSeconds: 86400, passwordHashCost: 4, corsAllowedOrigins: ["http://localhost:3001"], requestIdHeader: "x-request-id" },
  payment: { pakasirProjectSlug: "pulih", pakasirBaseUrl: "https://app.pakasir.com", pakasirPaymentBaseUrl: "https://app.pakasir.com", pakasirApiKey: "test-key", pakasirProviderTimeoutMs: 1000 },
  email: { resendApiKey: "test-resend-key", resendFromEmail: "no-reply@salmanabdurrahman.web.id", resendFromName: "Pulih" },
};

function seedBooking(): BookingDetailRecord {
  return {
    id: "booking-1",
    patientUserId: "patient-1",
    psychologistProfileId: "profile-1",
    psychologistUserId: "psych-1",
    sessionSlotId: "slot-1",
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
    patientEmail: "patient@example.com",
    psychologistEmail: "psych@example.com",
    psychologistFullName: "Dr. Psych",
    ratingSummary: { averageRating: 0, reviewCount: 0 },
    latestReviews: [],
  };
}

function createRepository() {
  const events: Array<{ type: string; status: string }> = [];
  const repository: NotificationsRepository = {
    async transaction(callback) { return callback(repository); },
    async findByBookingAndType(input) { return events.find((event) => event.type === input.type) ? { id: "event-1", type: input.type, recipientEmail: "patient@example.com", relatedBookingId: input.relatedBookingId, status: "sent", providerMessageId: "msg-1", lastError: null, attemptCount: 1, createdAt: new Date().toISOString(), sentAt: new Date().toISOString() } : null; },
    async create(input) { events.push({ type: input.type, status: input.status }); return { id: "event-1", type: input.type, recipientEmail: input.recipientEmail, relatedBookingId: input.relatedBookingId, status: input.status, providerMessageId: null, lastError: null, attemptCount: 1, createdAt: new Date().toISOString(), sentAt: null }; },
    async markSent() { return undefined; },
    async markFailed() { return undefined; },
  };
  return { repository, events };
}

describe("email templates", () => {
  test("render safe content", () => {
    const booking = seedBooking();
    expect(renderPaymentSuccessPatientTemplate({ booking, actionUrl: "https://app.example/bookings/booking-1" }).subject).toContain("Payment received");
    expect(renderBookingReceivedPsychologistTemplate({ booking, actionUrl: "https://app.example/bookings/booking-1" }).html).toContain("View booking");
    expect(renderBookingConfirmedSessionReadyTemplate({ booking, actionUrl: "https://app.example/bookings/booking-1" }).text).toContain("Meet link");
    expect(renderBookingRescheduledTemplate({ booking: { ...booking, status: "rescheduled", scheduledStartAt: "2026-02-02T08:00:00.000Z" }, actionUrl: "https://app.example/bookings/booking-1", reason: "New availability" }).text).toContain("New availability");
  });
});

describe("notification service", () => {
  test("skips duplicate emails after recorded event", async () => {
    const booking = seedBooking();
    const state = createRepository();
    const service = createNotificationsService({ repository: state.repository, config, resendClient: { async sendEmail() { throw new Error("should not send"); } } });

    const first = await service.sendBookingConfirmedSessionReady(booking);
    expect(first.skipped).toBe(false);
    const second = await service.sendBookingConfirmedSessionReady(booking);
    expect(second.skipped).toBe(true);
  });
});
