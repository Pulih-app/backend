import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { notificationEvents } from "../../db/schema";
import type { NotificationEventRecord, NotificationEventStatus, NotificationEventType } from "./notification.types";

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function mapNotificationEvent(row: typeof notificationEvents.$inferSelect): NotificationEventRecord {
  return {
    id: row.id,
    type: row.type as NotificationEventType,
    recipientEmail: row.recipientEmail,
    relatedBookingId: row.relatedBookingId,
    status: row.status as NotificationEventStatus,
    providerMessageId: row.providerMessageId,
    lastError: row.lastError,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt.toISOString(),
    sentAt: toIso(row.sentAt),
  };
}

export type NotificationsRepository = {
  transaction<T>(callback: (repository: NotificationsRepository) => Promise<T>): Promise<T>;
  findByBookingAndType(input: { relatedBookingId: string; type: NotificationEventType }): Promise<NotificationEventRecord | null>;
  create(input: { type: NotificationEventType; recipientEmail: string; relatedBookingId: string; status: NotificationEventStatus; attemptCount?: number }): Promise<NotificationEventRecord>;
  markSent(input: { id: string; providerMessageId: string | null; sentAt: Date }): Promise<void>;
  markFailed(input: { id: string; error: string }): Promise<void>;
};

function createRepository(source: NodePgDatabase): NotificationsRepository {
  return {
    async transaction<T>(callback: (repository: NotificationsRepository) => Promise<T>) {
      return source.transaction(async (tx) => callback(createRepository(tx as NodePgDatabase)));
    },
    async findByBookingAndType(input) {
      const [row] = await source.select().from(notificationEvents).where(and(
        eq(notificationEvents.relatedBookingId, input.relatedBookingId),
        eq(notificationEvents.type, input.type),
      )).limit(1);
      return row ? mapNotificationEvent(row) : null;
    },
    async create(input) {
      const [row] = await source.insert(notificationEvents).values({
        type: input.type,
        recipientEmail: input.recipientEmail,
        relatedBookingId: input.relatedBookingId,
        status: input.status,
        attemptCount: input.attemptCount ?? 1,
      }).returning();
      return mapNotificationEvent(row);
    },
    async markSent(input) {
      await source.update(notificationEvents).set({
        status: "sent",
        providerMessageId: input.providerMessageId,
        sentAt: input.sentAt,
        lastError: null,
      }).where(eq(notificationEvents.id, input.id));
    },
    async markFailed(input) {
      await source.update(notificationEvents).set({
        status: "failed",
        lastError: input.error,
      }).where(eq(notificationEvents.id, input.id));
    },
  };
}

export function createNotificationsRepository(db: NodePgDatabase) {
  return createRepository(db);
}
