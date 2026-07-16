export const NOTIFICATION_EVENT_TYPES = [
  "payment_success_patient",
  "booking_received_psychologist",
  "booking_confirmed_session_ready",
  "booking_rescheduled",
] as const;

export type NotificationEventType = typeof NOTIFICATION_EVENT_TYPES[number];

export const NOTIFICATION_EVENT_STATUSES = ["pending", "sent", "failed", "retrying", "cancelled"] as const;
export type NotificationEventStatus = typeof NOTIFICATION_EVENT_STATUSES[number];

export type NotificationEventRecord = {
  id: string;
  type: NotificationEventType;
  recipientEmail: string;
  relatedBookingId: string;
  status: NotificationEventStatus;
  providerMessageId: string | null;
  lastError: string | null;
  attemptCount: number;
  createdAt: string;
  sentAt: string | null;
};
