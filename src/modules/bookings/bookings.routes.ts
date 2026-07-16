import { Hono } from "hono";
import type { AppConfig } from "../../shared/config";
import { createSuccessResponse } from "../../shared/response";
import { validateJsonBody, validateParams } from "../../shared/http/validation";
import { createDatabaseHandle, type DatabaseSource } from "../../db/client";
import { authGuard, type AuthVariables } from "../auth/auth.middleware";
import { createAuthRepository, type AuthRepository } from "../auth/auth.repository";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { bookingParamsSchema, createBookingSchema } from "./bookings.schema";
import { createBookingsRepository, type BookingsRepository } from "./bookings.repository";
import { createBookingsService, type BookingsService } from "./bookings.service";

export type BookingsRoutesOptions = {
  config: AppConfig;
  databaseSource?: DatabaseSource;
  authRepository?: AuthRepository;
  authService?: AuthService;
  bookingsRepository?: BookingsRepository;
};

async function withService<T>(options: BookingsRoutesOptions, action: (service: BookingsService, authService: AuthService) => Promise<T>) {
  if (options.bookingsRepository && (options.authService || options.authRepository)) {
    const authService = options.authService ?? createAuthService(options.authRepository!, options.config);
    return action(createBookingsService(options.bookingsRepository, options.config), authService);
  }

  const handle = await createDatabaseHandle(options.databaseSource ?? {}, options.config);
  try {
    const authService = createAuthService(createAuthRepository(handle.db), options.config);
    return await action(createBookingsService(createBookingsRepository(handle.db), options.config), authService);
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
    const result = await service.createBooking(auth.id, payload);
    return context.json(createSuccessResponse({ message: "Booking created successfully", data: result }), 201);
  }));

  routes.get("/bookings", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const data = await service.listBookings(auth.id, auth.role);
    return context.json(createSuccessResponse({ message: "Bookings retrieved successfully", data }));
  }));

  routes.get("/bookings/:bookingId", async (context) => withService(options, async (service, authService) => {
    const auth = await requireAuth(context, options, authService);
    const params = validateParams(context, bookingParamsSchema);
    const data = await service.getBooking(auth.id, auth.role, params.bookingId);
    return context.json(createSuccessResponse({ message: "Booking retrieved successfully", data }));
  }));

  return routes;
}
