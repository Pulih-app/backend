import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createSuccessResponse } from "../../shared/response";
import { validateJsonBody, validateParams } from "../../shared/http/validation";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { authGuard, type AuthVariables } from "../auth/auth.middleware";
import { createAuthRepository, type AuthRepository } from "../auth/auth.repository";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { bookingMessageSchema, bookingParamsSchema, bookingReviewSchema, confirmBookingSchema, createBookingSchema, rescheduleBookingSchema } from "./bookings.schema";
import { createBookingsRepository, type BookingsRepository } from "./bookings.repository";
import { createBookingsService, type BookingsService } from "./bookings.service";
import { createNotificationsRepository } from "../notifications/notifications.repository";
import { createNotificationsService, type NotificationsService } from "../notifications/notifications.service";

export type BookingsRoutesOptions = {
  config: AppConfig;
  databaseSource?: DatabaseSource;
  authRepository?: AuthRepository;
  authService?: AuthService;
  bookingsRepository?: BookingsRepository;
  notificationsService?: NotificationsService;
};

async function withService<T>(options: BookingsRoutesOptions, action: (service: BookingsService, authService: AuthService) => Promise<T>) {
  if (options.bookingsRepository && (options.authService || options.authRepository)) {
    const authService = options.authService ?? createAuthService(options.authRepository!, options.config);
    return action(createBookingsService(options.bookingsRepository, options.config, options.notificationsService), authService);
  }

  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    const authService = createAuthService(createAuthRepository(handle.db), options.config);
    const notificationsService = options.notificationsService ?? createNotificationsService({ repository: createNotificationsRepository(handle.db), config: options.config });
    return await action(createBookingsService(createBookingsRepository(handle.db), options.config, notificationsService), authService);
  } finally {
    await handle.close();
  }
}

async function requireAuth(context: any, options: BookingsRoutesOptions, service: AuthService) {
  const middleware = authGuard({ service, config: options.config });
  await middleware(context, async () => undefined);
  return context.get("auth").user;
}

export function createBookingsRoutes(options: BookingsRoutesOptions) {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/bookings", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const payload = await validateJsonBody(context, createBookingSchema);
    const result = await service.createBooking(auth.id, auth.role, payload);
    return context.json(createSuccessResponse({ message: "Booking created successfully", data: result }), 201);
  }));

  routes.get("/bookings", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.listBookings(auth.id, auth.role);
    return context.json(createSuccessResponse({ message: "Bookings retrieved successfully", data }));
  }));

  routes.get("/psychologists/me/availability", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.listPsychologistAvailabilityDates(auth.id, auth.role);
    return context.json(createSuccessResponse({ message: "Availability dates retrieved successfully", data }));
  }));

  routes.get("/psychologists/me/bookings/today", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.listPsychologistBookingsToday(auth.id, auth.role);
    return context.json(createSuccessResponse({ message: "Today bookings retrieved successfully", data }));
  }));

  routes.post("/psychologists/me/bookings/:bookingId/approve", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const payload = await validateJsonBody(context, confirmBookingSchema);
    const data = await service.confirmBooking(auth.id, auth.role, params.bookingId, payload);
    return context.json(createSuccessResponse({ message: "Booking approved successfully", data }));
  }));

  routes.post("/psychologists/me/bookings/:bookingId/reschedule", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const payload = await validateJsonBody(context, rescheduleBookingSchema);
    const data = await service.rescheduleBooking(auth.id, auth.role, params.bookingId, payload);
    return context.json(createSuccessResponse({ message: "Booking rescheduled successfully", data }));
  }));

  routes.get("/bookings/:bookingId", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const data = await service.getBooking(auth.id, auth.role, params.bookingId);
    return context.json(createSuccessResponse({ message: "Booking retrieved successfully", data }));
  }));

  routes.post("/bookings/:bookingId/confirm", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const payload = await validateJsonBody(context, confirmBookingSchema);
    const data = await service.confirmBooking(auth.id, auth.role, params.bookingId, payload);
    return context.json(createSuccessResponse({ message: "Booking confirmed successfully", data }));
  }));

  routes.post("/bookings/:bookingId/complete", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const data = await service.completeBooking(auth.id, auth.role, params.bookingId);
    return context.json(createSuccessResponse({ message: "Booking completed successfully", data }));
  }));

  routes.get("/bookings/:bookingId/messages", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const data = await service.listMessages(auth.id, auth.role, params.bookingId);
    return context.json(createSuccessResponse({ message: "Booking messages retrieved successfully", data }));
  }));

  routes.post("/bookings/:bookingId/messages", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const payload = await validateJsonBody(context, bookingMessageSchema);
    const data = await service.createMessage(auth.id, auth.role, params.bookingId, payload);
    return context.json(createSuccessResponse({ message: "Booking message created successfully", data }), 201);
  }));

  routes.post("/bookings/:bookingId/review", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const payload = await validateJsonBody(context, bookingReviewSchema);
    const data = await service.createReview(auth.id, auth.role, params.bookingId, payload);
    return context.json(createSuccessResponse({ message: "Booking review created successfully", data }), 201);
  }));

  routes.post("/bookings/:bookingId/reschedule", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const payload = await validateJsonBody(context, rescheduleBookingSchema);
    const data = await service.rescheduleBooking(auth.id, auth.role, params.bookingId, payload);
    return context.json(createSuccessResponse({ message: "Booking rescheduled successfully", data }));
  }));

  return routes;
}
