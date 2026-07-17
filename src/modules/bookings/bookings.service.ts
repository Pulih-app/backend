import type { AppConfig } from "../../shared/config";
import { AppError, AppErrorCode } from "../../shared/errors";
import { buildPaymentInstruction, buildPakasirPaymentUrl, generateOrderId } from "../payments/pakasir";
import type { BookingRecord, BookingsRepository, PaymentRecord } from "./bookings.repository";
import type { BookingMessageInput, BookingReviewInput, ConfirmBookingInput, CreateBookingInput, RescheduleBookingInput } from "./bookings.schema";
import type { NotificationsService } from "../notifications/notifications.service";

function addHours(now: Date, hours: number) {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

const CHAT_ALLOWED_STATUSES = new Set(["payment_completed", "confirmed", "rescheduled", "completed"]);

function localDateInJakarta(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value instanceof Date ? value : new Date(value));
}

function hideMeetLink<T extends { status: string; consultationChannel: string; meetLink: string | null }>(booking: T) {
  return {
    ...booking,
    meetLink: booking.status === "confirmed" && booking.consultationChannel === "chat_and_meet" ? booking.meetLink : null,
  };
}

export type CreateBookingResult = {
  booking: BookingRecord;
  payment: PaymentRecord;
  paymentUrl: string;
  instruction: string;
};

export function createBookingsService(repository: BookingsRepository, config: AppConfig, notifications?: NotificationsService) {
  return {
    async createBooking(patientUserId: string, role: string, input: CreateBookingInput) {
      if (role !== "patient") throw new AppError(AppErrorCode.Forbidden, "Only patients can create bookings.");
      const now = new Date();
      return repository.transaction(async (tx) => {
        const session = await tx.findSessionSlotForBooking(input.sessionSlotId);
        if (!session) throw new AppError(AppErrorCode.NotFound, "Generated session was not found.");
        if (session.psychologistApprovalStatus !== "approved") throw new AppError(AppErrorCode.Forbidden, "Psychologist profile is not approved for booking.");
        if (session.status !== "available") throw new AppError(AppErrorCode.Conflict, "Generated session is not available.");

        const paymentExpiresAt = addHours(now, 1);
        const claimed = await tx.claimSessionSlot(input.sessionSlotId, paymentExpiresAt);
        if (!claimed) throw new AppError(AppErrorCode.Conflict, "Generated session is not available.");

        const booking = await tx.createBooking({
          patientUserId,
          psychologistProfileId: session.profileId,
          psychologistUserId: session.psychologistUserId,
          sessionSlotId: session.id,
          consultationChannel: session.consultationChannel,
          status: "pending_payment",
          scheduledStartAt: new Date(session.startsAt),
          scheduledEndAt: new Date(session.endsAt),
          priceAmount: session.priceAmount,
          packageNameSnapshot: session.packageName,
          packageDurationMinutesSnapshot: session.packageDurationMinutes,
          paymentExpiresAt,
          meetLink: null,
          complaint: input.complaint,
          psychologistType: session.psychologistType,
        });

        await tx.createBookingStatusEvent({
          bookingId: booking.id,
          fromStatus: null,
          toStatus: "pending_payment",
          actorUserId: patientUserId,
        });

        const orderId = generateOrderId(now);
        const paymentUrl = buildPakasirPaymentUrl({
          paymentBaseUrl: config.payment.pakasirPaymentBaseUrl,
          projectSlug: config.payment.pakasirProjectSlug,
          amount: booking.priceAmount,
          orderId,
        });

        const payment = await tx.createPayment({
          bookingId: booking.id,
          provider: "pakasir",
          orderId,
          amount: booking.priceAmount,
          status: "created",
          paymentUrl,
          expiresAt: paymentExpiresAt,
          providerMetadata: {
            project: config.payment.pakasirProjectSlug,
            baseUrl: config.payment.pakasirBaseUrl,
          },
        });

        return {
          booking: hideMeetLink(booking),
          payment,
          paymentUrl,
          instruction: buildPaymentInstruction(paymentUrl),
        } satisfies CreateBookingResult;
      });
    },
    async listBookings(userId: string, role: string) {
      if (role === "patient") return repository.listBookingsByPatientUserId(userId).then((items) => items.map(hideMeetLink));
      if (role === "psychologist") return repository.listBookingsByPsychologistUserId(userId).then((items) => items.map(hideMeetLink));
      throw new AppError(AppErrorCode.Forbidden, "You are not allowed to access bookings.");
    },
    async listPsychologistAvailabilityDates(userId: string, role: string) {
      if (role !== "psychologist") throw new AppError(AppErrorCode.Forbidden, "Only psychologists can access availability dates.");
      return repository.listAvailabilityDatesByPsychologistUserId(userId);
    },
    async listPsychologistBookingsToday(userId: string, role: string) {
      if (role !== "psychologist") throw new AppError(AppErrorCode.Forbidden, "Only psychologists can access today's bookings.");
      const today = localDateInJakarta(new Date());
      const bookings = await repository.listBookingsByPsychologistUserId(userId);
      return bookings
        .filter((booking) => localDateInJakarta(booking.scheduledStartAt) === today)
        .map(hideMeetLink);
    },
    async getBooking(userId: string, role: string, bookingId: string) {
      const booking = await repository.findBookingById(bookingId);
      if (!booking) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      if (role === "patient" && booking.patientUserId !== userId) throw new AppError(AppErrorCode.Forbidden, "You can only access your own bookings.");
      if (role === "psychologist" && booking.psychologistUserId !== userId) throw new AppError(AppErrorCode.Forbidden, "You can only access your own bookings.");
      if (role !== "patient" && role !== "psychologist") throw new AppError(AppErrorCode.Forbidden, "You are not allowed to access bookings.");
      return hideMeetLink(booking);
    },
    async confirmBooking(userId: string, role: string, bookingId: string, input: ConfirmBookingInput) {
      if (role !== "psychologist") throw new AppError(AppErrorCode.Forbidden, "Only psychologists can confirm bookings.");
      const booking = await repository.findBookingById(bookingId);
      if (!booking) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      if (booking.psychologistUserId !== userId) throw new AppError(AppErrorCode.Forbidden, "You can only manage your own bookings.");
      if (!["payment_completed", "rescheduled"].includes(booking.status)) throw new AppError(AppErrorCode.Conflict, "Booking is not ready for confirmation.");
      const meetLink = booking.psychologistType === "clinical" ? input.meetLink : null;
      if (booking.psychologistType === "clinical" && !meetLink) throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["meetLink: Meet link is required for clinical psychologist sessions."]);
      if (meetLink) {
        let url: URL;
        try {
          url = new URL(meetLink);
        } catch {
          throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["meetLink: Must be a valid URL."]);
        }
        if (url.protocol !== "https:" || url.hostname !== "meet.google.com") {
          throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["meetLink: Must be a Google Meet HTTPS URL."]);
        }
      }
      await repository.transaction(async (tx) => {
        await tx.markBookingConfirmed({ bookingId, meetLink, confirmedAt: new Date(), actorUserId: userId });
      });
      const updated = await repository.findBookingById(bookingId);
      if (!updated) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      if (notifications) await notifications.sendBookingConfirmedSessionReady(updated);
      return hideMeetLink(updated);
    },
    async completeBooking(userId: string, role: string, bookingId: string) {
      if (role !== "psychologist") throw new AppError(AppErrorCode.Forbidden, "Only psychologists can complete bookings.");
      const booking = await repository.findBookingById(bookingId);
      if (!booking) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      if (booking.psychologistUserId !== userId) throw new AppError(AppErrorCode.Forbidden, "You can only manage your own bookings.");
      if (!["confirmed", "rescheduled"].includes(booking.status)) throw new AppError(AppErrorCode.Conflict, "Booking is not ready for completion.");
      await repository.transaction(async (tx) => {
        await tx.markBookingCompleted({ bookingId, completedAt: new Date(), actorUserId: userId });
        await tx.markSessionSlotCompleted(booking.sessionSlotId);
      });
      const updated = await repository.findBookingById(bookingId);
      if (!updated) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      return hideMeetLink(updated);
    },
    async listMessages(userId: string, role: string, bookingId: string) {
      const booking = await this.getBooking(userId, role, bookingId);
      if (!CHAT_ALLOWED_STATUSES.has(booking.status)) throw new AppError(AppErrorCode.Conflict, "Booking chat is not available yet.");
      return repository.listMessagesByBookingId(bookingId);
    },
    async createMessage(userId: string, role: string, bookingId: string, input: BookingMessageInput) {
      const booking = await this.getBooking(userId, role, bookingId);
      if (!CHAT_ALLOWED_STATUSES.has(booking.status)) throw new AppError(AppErrorCode.Conflict, "Booking chat is not available yet.");
      return repository.createMessage({ bookingId, senderUserId: userId, content: input.content });
    },
    async createReview(userId: string, role: string, bookingId: string, input: BookingReviewInput) {
      if (role !== "patient") throw new AppError(AppErrorCode.Forbidden, "Only patients can review bookings.");
      const booking = await repository.findBookingById(bookingId);
      if (!booking) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      if (booking.patientUserId !== userId) throw new AppError(AppErrorCode.Forbidden, "You can only review your own bookings.");
      if (booking.status !== "completed") throw new AppError(AppErrorCode.Conflict, "Booking must be completed before review.");
      const existing = await repository.findReviewByBookingId(bookingId);
      if (existing) throw new AppError(AppErrorCode.Conflict, "Booking has already been reviewed.");
      return repository.createReview({
        bookingId,
        patientUserId: userId,
        psychologistProfileId: booking.psychologistProfileId,
        rating: input.rating,
        comment: input.comment,
      });
    },
    async rescheduleBooking(userId: string, role: string, bookingId: string, input: RescheduleBookingInput) {
      if (role !== "psychologist") throw new AppError(AppErrorCode.Forbidden, "Only psychologists can reschedule bookings.");
      const booking = await repository.findBookingById(bookingId);
      if (!booking) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      if (booking.psychologistUserId !== userId) throw new AppError(AppErrorCode.Forbidden, "You can only manage your own bookings.");
      if (!["payment_completed", "confirmed"].includes(booking.status)) throw new AppError(AppErrorCode.Conflict, "Booking is not ready for reschedule.");

      const nextSession = await repository.findSessionSlotForBooking(input.newSessionSlotId);
      if (!nextSession) throw new AppError(AppErrorCode.NotFound, "Generated session was not found.");
      if (nextSession.profileId !== booking.psychologistProfileId) throw new AppError(AppErrorCode.Conflict, "New generated session must belong to the same psychologist.");
      if (nextSession.status !== "available") throw new AppError(AppErrorCode.Conflict, "Generated session is not available.");

      await repository.transaction(async (tx) => {
        const claimed = await tx.claimSessionSlot(nextSession.id, new Date(Date.now() + 60 * 60 * 1000));
        if (!claimed) throw new AppError(AppErrorCode.Conflict, "Generated session is not available.");
        await tx.markBookingRescheduled({
          bookingId,
          sessionSlotId: nextSession.id,
          scheduledStartAt: new Date(nextSession.startsAt),
          scheduledEndAt: new Date(nextSession.endsAt),
          consultationChannel: nextSession.consultationChannel,
          rescheduledAt: new Date(),
          rescheduleReason: input.reason,
          actorUserId: userId,
        });
      });

      const updated = await repository.findBookingById(bookingId);
      if (!updated) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      if (notifications) await notifications.sendBookingRescheduled(updated, input.reason);
      return hideMeetLink(updated);
    },
  };
}

export type BookingsService = ReturnType<typeof createBookingsService>;
