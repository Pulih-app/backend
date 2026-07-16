import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { createSuccessResponse } from "../../shared/response";
import { validateJsonBody, validateParams } from "../../shared/http/validation";
import { createBookingsRepository, type BookingsRepository } from "../bookings/bookings.repository";
import { authGuard, type AuthVariables } from "../auth/auth.middleware";
import { createAuthRepository, type AuthRepository } from "../auth/auth.repository";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { pakasirWebhookSchema, paymentParamsSchema } from "./payments.schema";
import { createPaymentsService, type PaymentsService } from "./payments.service";
import { createNotificationsRepository } from "../notifications/notifications.repository";
import { createNotificationsService, type NotificationsService } from "../notifications/notifications.service";

export type PaymentsRoutesOptions = {
  config: AppConfig;
  databaseSource?: DatabaseSource;
  authRepository?: AuthRepository;
  authService?: AuthService;
  bookingsRepository?: BookingsRepository;
  notificationsService?: NotificationsService;
};

async function withService<T>(options: PaymentsRoutesOptions, action: (service: PaymentsService, authService: AuthService) => Promise<T>) {
  if (options.bookingsRepository && (options.authService || options.authRepository)) {
    const authService = options.authService ?? createAuthService(options.authRepository!, options.config);
    return action(createPaymentsService({ repository: options.bookingsRepository, config: options.config, notifications: options.notificationsService }), authService);
  }

  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    const notificationsService = options.notificationsService ?? createNotificationsService({ repository: createNotificationsRepository(handle.db), config: options.config });
    const authService = createAuthService(createAuthRepository(handle.db), options.config);
    return await action(createPaymentsService({ repository: createBookingsRepository(handle.db), config: options.config, notifications: notificationsService }), authService);
  } finally {
    await handle.close();
  }
}

async function requireAuth(context: any, options: PaymentsRoutesOptions, service: AuthService) {
  const middleware = authGuard({ service, config: options.config });
  await middleware(context, async () => undefined);
  return context.get("auth").user;
}

export function createPaymentsRoutes(options: PaymentsRoutesOptions) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.get("/payments/:paymentId/status", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, paymentParamsSchema);
    const data = await service.getPaymentStatus(auth.id, auth.role, params.paymentId);
    return context.json(createSuccessResponse({ message: "Payment status retrieved successfully", data }));
  }));

  routes.post("/payments/pakasir/webhook", async (context) => withService(options, async (service) => {
    const payload = await validateJsonBody(context, pakasirWebhookSchema);
    const data = await service.processPakasirWebhook(payload);
    return context.json(createSuccessResponse({ message: "Payment webhook processed successfully", data }));
  }));

  return routes;
}
