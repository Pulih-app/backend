import type { AppConfig } from "../../shared/config";
import { AppError, AppErrorCode } from "../../shared/errors";
import type { BookingDetailRecord } from "../bookings/bookings.repository";
import { createBookingEmailActionUrl, buildNotificationIdempotencyKey, createResendClient, renderBookingConfirmedSessionReadyTemplate, renderBookingReceivedPsychologistTemplate, renderBookingRescheduledTemplate, renderPaymentSuccessPatientTemplate, type ResendClient } from "./resend";
import type { NotificationEventRecord, NotificationEventType } from "./notification.types";
import type { NotificationsRepository } from "./notifications.repository";

export type NotificationsServiceOptions = {
  repository: NotificationsRepository;
  config: AppConfig;
  resendClient?: ResendClient;
};

type SendResult = { event: NotificationEventRecord; skipped: boolean };

function messageFromError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return "Email provider request failed.";
}

async function sendTemplatedEmail(input: {
  repository: NotificationsRepository;
  resendClient: ResendClient;
  type: NotificationEventType;
  recipientEmail: string;
  booking: BookingDetailRecord;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const existing = await input.repository.findByBookingAndType({ relatedBookingId: input.booking.id, type: input.type });
  if (existing) return { event: existing, skipped: true };

  const event = await input.repository.create({
    type: input.type,
    recipientEmail: input.recipientEmail,
    relatedBookingId: input.booking.id,
    status: "pending",
  });

  try {
    const response = await input.resendClient.sendEmail({
      to: input.recipientEmail,
      subject: input.subject,
      html: input.html,
      text: input.text,
      idempotencyKey: buildNotificationIdempotencyKey(input.type, input.booking.id),
    });
    await input.repository.markSent({ id: event.id, providerMessageId: response.id, sentAt: new Date() });
    return { event: { ...event, status: "sent", providerMessageId: response.id, sentAt: new Date().toISOString(), lastError: null }, skipped: false };
  } catch (error) {
    await input.repository.markFailed({ id: event.id, error: messageFromError(error) });
    return { event: { ...event, status: "failed", lastError: messageFromError(error) }, skipped: false };
  }
}

export function createNotificationsService(options: NotificationsServiceOptions) {
  const resendClient = options.resendClient ?? createResendClient({
    apiKey: options.config.email.resendApiKey,
    fromEmail: options.config.email.resendFromEmail,
    fromName: options.config.email.resendFromName,
  });

  return {
    async sendPaymentSuccessPatient(booking: BookingDetailRecord) {
      const template = renderPaymentSuccessPatientTemplate({ booking, actionUrl: createBookingEmailActionUrl(options.config, booking.id) });
      return sendTemplatedEmail({
        repository: options.repository,
        resendClient,
        type: "payment_success_patient",
        recipientEmail: booking.patientEmail,
        booking,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    },
    async sendBookingReceivedPsychologist(booking: BookingDetailRecord) {
      const template = renderBookingReceivedPsychologistTemplate({ booking, actionUrl: createBookingEmailActionUrl(options.config, booking.id) });
      return sendTemplatedEmail({
        repository: options.repository,
        resendClient,
        type: "booking_received_psychologist",
        recipientEmail: booking.psychologistEmail,
        booking,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    },
    async sendBookingConfirmedSessionReady(booking: BookingDetailRecord) {
      const template = renderBookingConfirmedSessionReadyTemplate({ booking, actionUrl: createBookingEmailActionUrl(options.config, booking.id) });
      return sendTemplatedEmail({
        repository: options.repository,
        resendClient,
        type: "booking_confirmed_session_ready",
        recipientEmail: booking.patientEmail,
        booking,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    },
    async sendBookingRescheduled(booking: BookingDetailRecord, reason: string) {
      const template = renderBookingRescheduledTemplate({ booking, actionUrl: createBookingEmailActionUrl(options.config, booking.id), reason });
      return sendTemplatedEmail({
        repository: options.repository,
        resendClient,
        type: "booking_rescheduled",
        recipientEmail: booking.patientEmail,
        booking,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
