import type { AppConfig } from "../../shared/config";
import { AppError, AppErrorCode } from "../../shared/errors";
import { buildPaymentInstruction, buildPakasirPaymentUrl, generateOrderId } from "../payments/pakasir";
import type { BookingDetailRecord, BookingRecord, BookingsRepository, PaymentRecord } from "./bookings.repository";
import type { CreateBookingInput } from "./bookings.schema";

function addHours(now: Date, hours: number) {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
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

export function createBookingsService(repository: BookingsRepository, config: AppConfig) {
  return {
    async createBooking(patientUserId: string, input: CreateBookingInput) {
      const now = new Date();
      return repository.transaction(async (tx) => {
        const session = await tx.findSessionSlotForBooking(input.sessionSlotId);
        if (!session) throw new AppError(AppErrorCode.NotFound, "Generated session was not found.");
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
    async getBooking(userId: string, role: string, bookingId: string) {
      const booking = await repository.findBookingById(bookingId);
      if (!booking) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
      if (role === "patient" && booking.patientUserId !== userId) throw new AppError(AppErrorCode.Forbidden, "You can only access your own bookings.");
      if (role === "psychologist" && booking.psychologistUserId !== userId) throw new AppError(AppErrorCode.Forbidden, "You can only access your own bookings.");
      if (role !== "patient" && role !== "psychologist") throw new AppError(AppErrorCode.Forbidden, "You are not allowed to access bookings.");
      return hideMeetLink(booking);
    },
  };
}

export type BookingsService = ReturnType<typeof createBookingsService>;
