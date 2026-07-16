import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type CreateBookingInput = {
  sessionSlotId: string;
};

export type BookingParams = {
  bookingId: string;
};

export type ConfirmBookingInput = {
  meetLink: string | null;
};

export type RescheduleBookingInput = {
  newSessionSlotId: string;
  reason: string;
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

export const confirmBookingSchema: Schema<ConfirmBookingInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;

  const issues: ValidationIssue[] = [];
  const value = object.value;
  for (const key of Object.keys(value)) {
    if (key !== "meetLink") issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  const meetLink = value.meetLink;
  if (meetLink !== undefined && meetLink !== null && typeof meetLink !== "string") {
    issues.push({ field: "meetLink", message: "Meet link must be a string." });
  }

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { meetLink: typeof meetLink === "string" ? meetLink.trim() : null } } as const;
};

export const rescheduleBookingSchema: Schema<RescheduleBookingInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;

  const issues: ValidationIssue[] = [];
  const value = object.value;
  for (const key of Object.keys(value)) {
    if (key !== "newSessionSlotId" && key !== "reason") issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  const newSessionSlotId = value.newSessionSlotId;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (typeof newSessionSlotId !== "string" || !UUID_PATTERN.test(newSessionSlotId)) {
    issues.push({ field: "newSessionSlotId", message: "Must be a valid session slot id." });
  }
  if (reason.length === 0) {
    issues.push({ field: "reason", message: "Reason is required." });
  }

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { newSessionSlotId: newSessionSlotId as string, reason } } as const;
};
