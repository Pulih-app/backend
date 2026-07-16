import type { AppConfig } from "../../shared/config";
import { AppError, AppErrorCode } from "../../shared/errors";
import type { BookingDetailRecord } from "../bookings/bookings.repository";
import type { NotificationEventType } from "./notification.types";

export type ResendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type ResendClient = {
  sendEmail(input: ResendEmailInput): Promise<{ id: string }>;
};

type ResendClientOptions = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
};

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatSchedule(dateTime: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateTime));
}

function buildActionUrl(baseUrl: string, bookingId: string) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/bookings/${bookingId}`;
}

function wrapHtml(title: string, body: string) {
  return `<!doctype html><html><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

export function renderPaymentSuccessPatientTemplate(input: { booking: BookingDetailRecord; actionUrl: string }): EmailTemplate {
  const schedule = formatSchedule(input.booking.scheduledStartAt);
  const subject = `Payment received for ${input.booking.packageNameSnapshot}`;
  const text = [
    "Payment confirmed.",
    `Schedule: ${schedule}`,
    `Status: ${input.booking.status}`,
    `Action: ${input.actionUrl}`,
  ].join("\n");
  const html = wrapHtml(subject, `
    <p>Payment confirmed.</p>
    <ul>
      <li>Schedule: ${escapeHtml(schedule)}</li>
      <li>Status: ${escapeHtml(input.booking.status)}</li>
      <li>Action: <a href="${escapeHtml(input.actionUrl)}">View booking</a></li>
    </ul>
  `);
  return { subject, html, text };
}

export function renderBookingReceivedPsychologistTemplate(input: { booking: BookingDetailRecord; actionUrl: string }): EmailTemplate {
  const schedule = formatSchedule(input.booking.scheduledStartAt);
  const subject = `New booking received for ${input.booking.packageNameSnapshot}`;
  const text = [
    "New booking received.",
    `Patient: ${input.booking.patientEmail}`,
    `Schedule: ${schedule}`,
    `Status: ${input.booking.status}`,
    `Action: ${input.actionUrl}`,
  ].join("\n");
  const html = wrapHtml(subject, `
    <p>New booking received.</p>
    <ul>
      <li>Patient: ${escapeHtml(input.booking.patientEmail)}</li>
      <li>Schedule: ${escapeHtml(schedule)}</li>
      <li>Status: ${escapeHtml(input.booking.status)}</li>
      <li>Action: <a href="${escapeHtml(input.actionUrl)}">View booking</a></li>
    </ul>
  `);
  return { subject, html, text };
}

export function renderBookingConfirmedSessionReadyTemplate(input: { booking: BookingDetailRecord; actionUrl: string }): EmailTemplate {
  const schedule = formatSchedule(input.booking.scheduledStartAt);
  const subject = `Your session is ready with ${input.booking.psychologistFullName}`;
  const lines = [
    "Your booking has been confirmed.",
    `Psychologist: ${input.booking.psychologistFullName}`,
    `Schedule: ${schedule}`,
    `Status: ${input.booking.status}`,
    input.booking.meetLink ? `Meet link: ${input.booking.meetLink}` : "Chat access is available in your booking page.",
    `Action: ${input.actionUrl}`,
  ];
  const text = lines.join("\n");
  const html = wrapHtml(subject, `
    <p>Your booking has been confirmed.</p>
    <ul>
      <li>Psychologist: ${escapeHtml(input.booking.psychologistFullName)}</li>
      <li>Schedule: ${escapeHtml(schedule)}</li>
      <li>Status: ${escapeHtml(input.booking.status)}</li>
      <li>${input.booking.meetLink ? `Meet link: <a href="${escapeHtml(input.booking.meetLink)}">Open meeting</a>` : "Chat access is available in your booking page."}</li>
      <li>Action: <a href="${escapeHtml(input.actionUrl)}">View booking</a></li>
    </ul>
  `);
  return { subject, html, text };
}

export function renderBookingRescheduledTemplate(input: { booking: BookingDetailRecord; actionUrl: string; reason: string }): EmailTemplate {
  const schedule = formatSchedule(input.booking.scheduledStartAt);
  const subject = `Your session was rescheduled with ${input.booking.psychologistFullName}`;
  const text = [
    "Your booking was rescheduled.",
    `Psychologist: ${input.booking.psychologistFullName}`,
    `Reason: ${input.reason}`,
    `Schedule: ${schedule}`,
    `Status: ${input.booking.status}`,
    `Action: ${input.actionUrl}`,
  ].join("\n");
  const html = wrapHtml(subject, `
    <p>Your booking was rescheduled.</p>
    <ul>
      <li>Psychologist: ${escapeHtml(input.booking.psychologistFullName)}</li>
      <li>Reason: ${escapeHtml(input.reason)}</li>
      <li>Schedule: ${escapeHtml(schedule)}</li>
      <li>Status: ${escapeHtml(input.booking.status)}</li>
      <li>Action: <a href="${escapeHtml(input.actionUrl)}">View booking</a></li>
    </ul>
  `);
  return { subject, html, text };
}

export function createResendClient(options: ResendClientOptions): ResendClient {
  const baseUrl = (options.baseUrl ?? "https://api.resend.com").replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;
  const from = `${options.fromName} <${options.fromEmail}>`;

  return {
    async sendEmail(input) {
      const response = await fetcher(`${baseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });

      if (!response.ok) {
        throw new AppError(AppErrorCode.DownstreamError, "Email provider request failed.");
      }

      const body = await response.json() as { id?: string };
      return { id: body.id ?? crypto.randomUUID() };
    },
  };
}

export function createBookingEmailActionUrl(config: AppConfig, bookingId: string) {
  return buildActionUrl(config.app.pwaUrl, bookingId);
}

export function buildNotificationIdempotencyKey(type: NotificationEventType, bookingId: string) {
  return `${type}:${bookingId}`;
}
