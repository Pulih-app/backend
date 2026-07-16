import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  bookingStatusEvents,
  bookings,
  paymentEvents,
  payments,
  psychologistProfiles,
  psychologistSessionBundles,
  psychologistSessionSlots,
  users,
} from "../../db/schema";
import type { ConsultationChannel, GeneratedSessionStatus, PsychologistType } from "../psychologists/psychologists.types";

export type SessionSlotBookingRecord = {
  id: string;
  bundleId: string;
  profileId: string;
  psychologistUserId: string;
  psychologistType: PsychologistType;
  consultationChannel: ConsultationChannel;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: GeneratedSessionStatus;
  heldUntil: string | null;
  packageName: string;
  packageDurationMinutes: number;
  priceAmount: number;
};

export type BookingRecord = {
  id: string;
  patientUserId: string;
  psychologistProfileId: string;
  psychologistUserId: string;
  sessionSlotId: string;
  consultationChannel: ConsultationChannel;
  status: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  priceAmount: number;
  packageNameSnapshot: string;
  packageDurationMinutesSnapshot: number;
  paymentExpiresAt: string;
  meetLink: string | null;
  confirmedAt: string | null;
  rescheduledAt: string | null;
  rescheduleReason: string | null;
  createdAt: string;
  updatedAt: string;
  psychologistType: PsychologistType;
};

export type PaymentRecord = {
  id: string;
  bookingId: string;
  provider: string;
  orderId: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  paymentUrl: string | null;
  completedAt: string | null;
  expiresAt: string;
  providerMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BookingDetailRecord = BookingRecord & {
  patientEmail: string;
  psychologistEmail: string;
  psychologistFullName: string;
};

export type BookingsRepository = {
  transaction<T>(callback: (repository: BookingsRepository) => Promise<T>): Promise<T>;
  findSessionSlotForBooking(sessionSlotId: string): Promise<SessionSlotBookingRecord | null>;
  claimSessionSlot(sessionSlotId: string, heldUntil: Date): Promise<SessionSlotBookingRecord | null>;
  createBooking(input: {
    patientUserId: string;
    psychologistProfileId: string;
    psychologistUserId: string;
    sessionSlotId: string;
    consultationChannel: ConsultationChannel;
    status: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    priceAmount: number;
    packageNameSnapshot: string;
    packageDurationMinutesSnapshot: number;
    paymentExpiresAt: Date;
    meetLink: string | null;
    confirmedAt?: Date | null;
    rescheduledAt?: Date | null;
    rescheduleReason?: string | null;
    psychologistType: PsychologistType;
  }): Promise<BookingRecord>;
  createBookingStatusEvent(input: { bookingId: string; fromStatus: string | null; toStatus: string; reason?: string | null; actorUserId?: string | null }): Promise<void>;
  createPayment(input: { bookingId: string; provider: string; orderId: string; amount: number; status: string; paymentMethod?: string | null; paymentUrl?: string | null; expiresAt: Date; providerMetadata: Record<string, unknown> }): Promise<PaymentRecord>;
  findBookingById(bookingId: string): Promise<BookingDetailRecord | null>;
  listBookingsByPatientUserId(userId: string): Promise<BookingDetailRecord[]>;
  listBookingsByPsychologistUserId(userId: string): Promise<BookingDetailRecord[]>;
  findPaymentByOrderId(orderId: string): Promise<PaymentRecord | null>;
  hasPaymentEvent(input: { paymentId: string; eventType: string; providerStatus: string; orderId: string; amount: number }): Promise<boolean>;
  createPaymentEvent(input: { paymentId: string; provider: string; eventType: string; providerStatus: string; orderId: string; amount: number; rawPayloadSafe: Record<string, unknown>; processedAt?: Date | null }): Promise<void>;
  markPaymentCompleted(input: { paymentId: string; paymentMethod: string | null; completedAt: Date }): Promise<void>;
  markBookingPaymentCompleted(input: { bookingId: string; actorUserId?: string | null }): Promise<void>;
  markSessionSlotBooked(sessionSlotId: string): Promise<void>;
};

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

async function loadUser(database: NodePgDatabase, userId: string) {
  const [row] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

function mapSessionSlot(row: {
  slot: typeof psychologistSessionSlots.$inferSelect;
  bundle: typeof psychologistSessionBundles.$inferSelect;
  profile: typeof psychologistProfiles.$inferSelect;
}): SessionSlotBookingRecord {
  return {
    id: row.slot.id,
    bundleId: row.slot.bundleId,
    profileId: row.slot.profileId,
    psychologistUserId: row.profile.userId,
    psychologistType: row.profile.type as PsychologistType,
    consultationChannel: row.profile.consultationChannel as ConsultationChannel,
    sessionDate: row.slot.sessionDate.toISOString(),
    startsAt: row.slot.startsAt.toISOString(),
    endsAt: row.slot.endsAt.toISOString(),
    status: row.slot.status as GeneratedSessionStatus,
    heldUntil: toIso(row.slot.heldUntil),
    packageName: row.bundle.packageName,
    packageDurationMinutes: row.bundle.packageDurationMinutes,
    priceAmount: toNumber(row.bundle.priceAmount),
  };
}

function mapPayment(row: typeof payments.$inferSelect): PaymentRecord {
  return {
    id: row.id,
    bookingId: row.bookingId,
    provider: row.provider,
    orderId: row.orderId,
    amount: toNumber(row.amount),
    status: row.status,
    paymentMethod: row.paymentMethod,
    paymentUrl: row.paymentUrl,
    completedAt: toIso(row.completedAt),
    expiresAt: row.expiresAt.toISOString(),
    providerMetadata: row.providerMetadata as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapBooking(row: {
  booking: typeof bookings.$inferSelect;
  patientEmail: string;
  psychologistEmail: string;
  psychologistFullName: string;
  psychologistType: PsychologistType;
  psychologistUserId: string;
}): BookingDetailRecord {
  return {
    id: row.booking.id,
    patientUserId: row.booking.patientUserId,
    psychologistProfileId: row.booking.psychologistProfileId,
    psychologistUserId: row.psychologistUserId,
    sessionSlotId: row.booking.sessionSlotId,
    consultationChannel: row.booking.consultationChannel as ConsultationChannel,
    status: row.booking.status,
    scheduledStartAt: row.booking.scheduledStartAt.toISOString(),
    scheduledEndAt: row.booking.scheduledEndAt.toISOString(),
    priceAmount: toNumber(row.booking.priceAmount),
    packageNameSnapshot: row.booking.packageNameSnapshot,
    packageDurationMinutesSnapshot: row.booking.packageDurationMinutesSnapshot,
    paymentExpiresAt: row.booking.paymentExpiresAt.toISOString(),
    meetLink: row.booking.meetLink,
    confirmedAt: toIso(row.booking.confirmedAt),
    rescheduledAt: toIso(row.booking.rescheduledAt),
    rescheduleReason: row.booking.rescheduleReason,
    createdAt: row.booking.createdAt.toISOString(),
    updatedAt: row.booking.updatedAt.toISOString(),
    psychologistType: row.psychologistType,
    patientEmail: row.patientEmail,
    psychologistEmail: row.psychologistEmail,
    psychologistFullName: row.psychologistFullName,
  };
}

async function loadBooking(database: NodePgDatabase, bookingId: string) {
  const [row] = await database
    .select({ booking: bookings, psychologistProfile: psychologistProfiles })
    .from(bookings)
    .innerJoin(psychologistProfiles, eq(bookings.psychologistProfileId, psychologistProfiles.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) return null;
  const patient = await loadUser(database, row.booking.patientUserId);
  const psychologist = await loadUser(database, row.psychologistProfile.userId);
  if (!patient || !psychologist) return null;
  return mapBooking({
    booking: row.booking,
    patientEmail: patient.email,
    psychologistEmail: psychologist.email,
    psychologistFullName: row.psychologistProfile.fullName,
    psychologistType: row.psychologistProfile.type as PsychologistType,
    psychologistUserId: row.psychologistProfile.userId,
  });
}

async function loadBookingList(database: NodePgDatabase, userId: string, role: "patient" | "psychologist") {
  const rows = await database
    .select({ booking: bookings, psychologistProfile: psychologistProfiles })
    .from(bookings)
    .innerJoin(psychologistProfiles, eq(bookings.psychologistProfileId, psychologistProfiles.id))
    .where(role === "patient" ? eq(bookings.patientUserId, userId) : eq(psychologistProfiles.userId, userId))
    .orderBy(bookings.createdAt);

  const result: BookingDetailRecord[] = [];
  for (const row of rows) {
    const patient = await loadUser(database, row.booking.patientUserId);
    const psychologist = await loadUser(database, row.psychologistProfile.userId);
    if (!patient || !psychologist) continue;
    result.push(mapBooking({
      booking: row.booking,
      patientEmail: patient.email,
      psychologistEmail: psychologist.email,
      psychologistFullName: row.psychologistProfile.fullName,
      psychologistType: row.psychologistProfile.type as PsychologistType,
      psychologistUserId: row.psychologistProfile.userId,
    }));
  }
  return result;
}

function createRepository(source: NodePgDatabase): BookingsRepository {
  return {
    async transaction<T>(callback: (repository: BookingsRepository) => Promise<T>) {
      return source.transaction(async (tx) => callback(createRepository(tx as NodePgDatabase)));
    },
    async findSessionSlotForBooking(sessionSlotId) {
      const [row] = await source
        .select({ slot: psychologistSessionSlots, bundle: psychologistSessionBundles, profile: psychologistProfiles })
        .from(psychologistSessionSlots)
        .innerJoin(psychologistSessionBundles, eq(psychologistSessionSlots.bundleId, psychologistSessionBundles.id))
        .innerJoin(psychologistProfiles, eq(psychologistSessionSlots.profileId, psychologistProfiles.id))
        .where(eq(psychologistSessionSlots.id, sessionSlotId))
        .limit(1);
      return row ? mapSessionSlot(row) : null;
    },
    async claimSessionSlot(sessionSlotId, heldUntil) {
      const [row] = await source.update(psychologistSessionSlots).set({
        status: "held" as const,
        heldUntil,
        updatedAt: new Date(),
      }).where(and(eq(psychologistSessionSlots.id, sessionSlotId), eq(psychologistSessionSlots.status, "available"))).returning();

      if (!row) return null;
      return this.findSessionSlotForBooking(sessionSlotId);
    },
    async createBooking(input) {
      const [row] = await source.insert(bookings).values({
        patientUserId: input.patientUserId,
        psychologistProfileId: input.psychologistProfileId,
        sessionSlotId: input.sessionSlotId,
        consultationChannel: input.consultationChannel,
        status: input.status as "draft" | "pending_payment" | "payment_completed" | "confirmed" | "reschedule_requested" | "rescheduled" | "cancelled" | "expired" | "completed" | "no_show",
        scheduledStartAt: input.scheduledStartAt,
        scheduledEndAt: input.scheduledEndAt,
        priceAmount: String(input.priceAmount),
        packageNameSnapshot: input.packageNameSnapshot,
        packageDurationMinutesSnapshot: input.packageDurationMinutesSnapshot,
        paymentExpiresAt: input.paymentExpiresAt,
        meetLink: input.meetLink,
        confirmedAt: input.confirmedAt ?? null,
        rescheduledAt: input.rescheduledAt ?? null,
        rescheduleReason: input.rescheduleReason ?? null,
      }).returning();

      return {
        id: row.id,
        patientUserId: row.patientUserId,
        psychologistProfileId: row.psychologistProfileId,
        psychologistUserId: input.psychologistUserId,
        sessionSlotId: row.sessionSlotId,
        consultationChannel: row.consultationChannel as ConsultationChannel,
        status: row.status,
        scheduledStartAt: row.scheduledStartAt.toISOString(),
        scheduledEndAt: row.scheduledEndAt.toISOString(),
        priceAmount: toNumber(row.priceAmount),
        packageNameSnapshot: row.packageNameSnapshot,
        packageDurationMinutesSnapshot: row.packageDurationMinutesSnapshot,
        paymentExpiresAt: row.paymentExpiresAt.toISOString(),
        meetLink: row.meetLink,
        confirmedAt: toIso(row.confirmedAt),
        rescheduledAt: toIso(row.rescheduledAt),
        rescheduleReason: row.rescheduleReason,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        psychologistType: input.psychologistType,
      };
    },
    async createBookingStatusEvent(input) {
      await source.insert(bookingStatusEvents).values({
        bookingId: input.bookingId,
        fromStatus: input.fromStatus as "draft" | "pending_payment" | "payment_completed" | "confirmed" | "reschedule_requested" | "rescheduled" | "cancelled" | "expired" | "completed" | "no_show" | null,
        toStatus: input.toStatus as "draft" | "pending_payment" | "payment_completed" | "confirmed" | "reschedule_requested" | "rescheduled" | "cancelled" | "expired" | "completed" | "no_show",
        reason: input.reason ?? null,
        actorUserId: input.actorUserId ?? null,
      });
    },
    async createPayment(input) {
      const [row] = await source.insert(payments).values({
        bookingId: input.bookingId,
        provider: input.provider,
        orderId: input.orderId,
        amount: String(input.amount),
        status: input.status as "created" | "pending" | "completed" | "failed" | "expired" | "cancelled",
        paymentMethod: input.paymentMethod ?? null,
        paymentUrl: input.paymentUrl ?? null,
        expiresAt: input.expiresAt,
        providerMetadata: input.providerMetadata,
      }).returning();

      return mapPayment(row);
    },
    async findBookingById(bookingId) {
      return loadBooking(source, bookingId);
    },
    async listBookingsByPatientUserId(userId) {
      return loadBookingList(source, userId, "patient");
    },
    async listBookingsByPsychologistUserId(userId) {
      return loadBookingList(source, userId, "psychologist");
    },
    async findPaymentByOrderId(orderId) {
      const [row] = await source.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
      return row ? mapPayment(row) : null;
    },
    async hasPaymentEvent(input) {
      const [row] = await source.select().from(paymentEvents).where(and(
        eq(paymentEvents.paymentId, input.paymentId),
        eq(paymentEvents.eventType, input.eventType),
        eq(paymentEvents.providerStatus, input.providerStatus),
        eq(paymentEvents.orderId, input.orderId),
        eq(paymentEvents.amount, String(input.amount)),
      )).limit(1);
      return Boolean(row);
    },
    async createPaymentEvent(input) {
      await source.insert(paymentEvents).values({
        paymentId: input.paymentId,
        provider: input.provider,
        eventType: input.eventType,
        providerStatus: input.providerStatus,
        orderId: input.orderId,
        amount: String(input.amount),
        rawPayloadSafe: input.rawPayloadSafe,
        processedAt: input.processedAt ?? null,
      });
    },
    async markPaymentCompleted(input) {
      await source.update(payments).set({
        status: "completed",
        paymentMethod: input.paymentMethod,
        completedAt: input.completedAt,
        updatedAt: new Date(),
      }).where(eq(payments.id, input.paymentId));
    },
    async markBookingPaymentCompleted(input) {
      const booking = await loadBooking(source, input.bookingId);
      if (!booking || booking.status === "payment_completed") return;
      await source.update(bookings).set({ status: "payment_completed", updatedAt: new Date() }).where(eq(bookings.id, input.bookingId));
      await this.createBookingStatusEvent({
        bookingId: input.bookingId,
        fromStatus: booking.status,
        toStatus: "payment_completed",
        actorUserId: input.actorUserId ?? null,
      });
    },
    async markSessionSlotBooked(sessionSlotId) {
      await source.update(psychologistSessionSlots).set({ status: "booked", heldUntil: null, updatedAt: new Date() }).where(eq(psychologistSessionSlots.id, sessionSlotId));
    },
  };
}

export function createBookingsRepository(db: NodePgDatabase): BookingsRepository {
  return createRepository(db);
}
