import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { createSuccessResponse } from "../../shared/response";
import { validateJsonBody } from "../../shared/http/validation";
import { createBookingsRepository, type BookingsRepository } from "../bookings/bookings.repository";
import { pakasirWebhookSchema } from "./payments.schema";
import { createPaymentsService, type PaymentsService } from "./payments.service";
import { createNotificationsRepository } from "../notifications/notifications.repository";
import { createNotificationsService, type NotificationsService } from "../notifications/notifications.service";

export type PaymentsRoutesOptions = {
  config: AppConfig;
  databaseSource?: DatabaseSource;
  bookingsRepository?: BookingsRepository;
  notificationsService?: NotificationsService;
};

async function withService<T>(options: PaymentsRoutesOptions, action: (service: PaymentsService) => Promise<T>) {
  if (options.bookingsRepository) return action(createPaymentsService({ repository: options.bookingsRepository, config: options.config, notifications: options.notificationsService }));

  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    const notificationsService = options.notificationsService ?? createNotificationsService({ repository: createNotificationsRepository(handle.db), config: options.config });
    return await action(createPaymentsService({ repository: createBookingsRepository(handle.db), config: options.config, notifications: notificationsService }));
  } finally {
    await handle.close();
  }
}

export function createPaymentsRoutes(options: PaymentsRoutesOptions) {
  const routes = new Hono();

  routes.post("/payments/pakasir/webhook", async (context) => withService(options, async (service) => {
    const payload = await validateJsonBody(context, pakasirWebhookSchema);
    const data = await service.processPakasirWebhook(payload);
    return context.json(createSuccessResponse({ message: "Payment webhook processed successfully", data }));
  }));

  return routes;
}
