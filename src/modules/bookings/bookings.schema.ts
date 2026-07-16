import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type CreateBookingInput = {
  sessionSlotId: string;
};

export type BookingParams = {
  bookingId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ensureObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ field: "body", message: "Request body must be an object." }] } as const;
  }
  return { ok: true, value: input as Record<string, unknown> } as const;
}

export const createBookingSchema: Schema<CreateBookingInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;

  const issues: ValidationIssue[] = [];
  const value = object.value;
  for (const key of Object.keys(value)) {
    if (key !== "sessionSlotId") issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  const sessionSlotId = value.sessionSlotId;
  if (typeof sessionSlotId !== "string" || !UUID_PATTERN.test(sessionSlotId)) {
    issues.push({ field: "sessionSlotId", message: "Must be a valid session slot id." });
  }

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { sessionSlotId: sessionSlotId as string } } as const;
};

export const bookingParamsSchema: Schema<BookingParams> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;

  const bookingId = object.value.bookingId;
  if (typeof bookingId !== "string" || !UUID_PATTERN.test(bookingId)) {
    return { ok: false, issues: [{ field: "bookingId", message: "Must be a valid booking id." }] };
  }

  return { ok: true, value: { bookingId } };
};
