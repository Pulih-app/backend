import type { AppConfig } from "../../shared/config";
import { AppError, AppErrorCode } from "../../shared/errors";
import type { BookingsRepository } from "../bookings/bookings.repository";
import { createPakasirClient, type PakasirClient } from "./pakasir";
import type { PakasirWebhookInput } from "./payments.schema";

export type PaymentsServiceOptions = {
  repository: BookingsRepository;
  config: AppConfig;
  pakasirClient?: PakasirClient;
};

function assertPaymentMatches(payment: { orderId: string; amount: number }, input: PakasirWebhookInput, config: AppConfig) {
  if (input.project !== config.payment.pakasirProjectSlug) throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["project: Project does not match payment configuration."]);
  if (input.orderId !== payment.orderId) throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["order_id: Order id does not match payment record."]);
  if (Math.round(input.amount) !== Math.round(payment.amount)) throw new AppError(AppErrorCode.ValidationError, "Request validation failed.", ["amount: Amount does not match payment record."]);
}

function assertProviderCompleted(transaction: { project: string; orderId: string; amount: number; status: string }, input: PakasirWebhookInput) {
  if (transaction.project !== input.project || transaction.orderId !== input.orderId || Math.round(transaction.amount) !== Math.round(input.amount)) {
    throw new AppError(AppErrorCode.DownstreamError, "Payment provider verification did not match webhook payload.");
  }
  if (transaction.status !== "completed") throw new AppError(AppErrorCode.Conflict, "Payment is not completed by provider.");
}

export function createPaymentsService(options: PaymentsServiceOptions) {
  const client = options.pakasirClient ?? createPakasirClient({
    baseUrl: options.config.payment.pakasirBaseUrl,
    apiKey: options.config.payment.pakasirApiKey,
    timeoutMs: options.config.payment.pakasirProviderTimeoutMs,
  });

  return {
    async verifyTransactionDetail(input: { project: string; orderId: string; amount: number }) {
      return client.getTransactionDetail(input);
    },
    async simulatePakasirPayment(input: { orderId: string }) {
      const payment = await options.repository.findPaymentByOrderId(input.orderId);
      if (!payment) throw new AppError(AppErrorCode.NotFound, "Payment was not found.");
      await client.simulatePayment({ project: options.config.payment.pakasirProjectSlug, orderId: payment.orderId, amount: payment.amount });
      return { orderId: payment.orderId, amount: payment.amount, status: "simulation_requested" };
    },
    async processPakasirWebhook(input: PakasirWebhookInput) {
      const payment = await options.repository.findPaymentByOrderId(input.orderId);
      if (!payment) throw new AppError(AppErrorCode.NotFound, "Payment was not found.");
      assertPaymentMatches(payment, input, options.config);

      const duplicate = await options.repository.hasPaymentEvent({
        paymentId: payment.id,
        eventType: "webhook",
        providerStatus: input.status,
        orderId: input.orderId,
        amount: input.amount,
      });
      if (duplicate && payment.status === "completed") return { paymentId: payment.id, bookingId: payment.bookingId, status: "completed", idempotent: true };

      const transaction = await client.getTransactionDetail({ project: input.project, orderId: input.orderId, amount: input.amount });
      assertProviderCompleted(transaction, input);
      const completedAt = new Date(transaction.completedAt ?? input.completedAt ?? new Date().toISOString());

      await options.repository.transaction(async (tx) => {
        if (!duplicate) {
          await tx.createPaymentEvent({
            paymentId: payment.id,
            provider: "pakasir",
            eventType: "webhook",
            providerStatus: input.status,
            orderId: input.orderId,
            amount: input.amount,
            processedAt: completedAt,
            rawPayloadSafe: {
              project: input.project,
              order_id: input.orderId,
              amount: input.amount,
              status: input.status,
              payment_method: input.paymentMethod,
              completed_at: input.completedAt,
            },
          });
        }
        await tx.markPaymentCompleted({ paymentId: payment.id, paymentMethod: transaction.paymentMethod ?? input.paymentMethod, completedAt });
        const booking = await tx.findBookingById(payment.bookingId);
        if (!booking) throw new AppError(AppErrorCode.NotFound, "Booking was not found.");
        await tx.markBookingPaymentCompleted({ bookingId: payment.bookingId });
        await tx.markSessionSlotBooked(booking.sessionSlotId);
      });

      return { paymentId: payment.id, bookingId: payment.bookingId, status: "completed", idempotent: false };
    },
  };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
