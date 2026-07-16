import type { Schema, ValidationIssue } from "../../shared/http/validation";

export type CreateBookingInput = {
  sessionSlotId: string;
  complaint: string;
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

export type BookingMessageInput = {
  content: string;
};

export type BookingReviewInput = {
  rating: number;
  comment: string | null;
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
    if (key !== "sessionSlotId" && key !== "complaint") issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  const sessionSlotId = value.sessionSlotId;
  if (typeof sessionSlotId !== "string" || !UUID_PATTERN.test(sessionSlotId)) {
    issues.push({ field: "sessionSlotId", message: "Must be a valid session slot id." });
  }

  const complaint = typeof value.complaint === "string" ? value.complaint.trim() : "";
  if (complaint.length === 0) issues.push({ field: "complaint", message: "Complaint is required." });
  if (complaint.length > 500) issues.push({ field: "complaint", message: "Complaint must be at most 500 characters." });

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { sessionSlotId: sessionSlotId as string, complaint } } as const;
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

export const bookingMessageSchema: Schema<BookingMessageInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;

  const issues: ValidationIssue[] = [];
  const value = object.value;
  for (const key of Object.keys(value)) {
    if (key !== "content") issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  const content = typeof value.content === "string" ? value.content.trim() : "";
  if (content.length === 0) issues.push({ field: "content", message: "Content is required." });
  if (content.length > 2000) issues.push({ field: "content", message: "Content must be at most 2000 characters." });

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { content } } as const;
};

export const bookingReviewSchema: Schema<BookingReviewInput> = (input) => {
  const object = ensureObject(input);
  if (!object.ok) return object;

  const issues: ValidationIssue[] = [];
  const value = object.value;
  for (const key of Object.keys(value)) {
    if (key !== "rating" && key !== "comment") issues.push({ field: key, message: "Unknown field is not allowed." });
  }

  const rating = value.rating;
  const comment = value.comment;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    issues.push({ field: "rating", message: "Rating must be an integer between 1 and 5." });
  }
  if (comment !== undefined && comment !== null && typeof comment !== "string") {
    issues.push({ field: "comment", message: "Comment must be a string or null." });
  }
  const normalizedComment = typeof comment === "string" && comment.trim().length > 0 ? comment.trim() : null;
  if (normalizedComment && normalizedComment.length > 2000) issues.push({ field: "comment", message: "Comment must be at most 2000 characters." });

  if (issues.length > 0) return { ok: false, issues } as const;
  return { ok: true, value: { rating: rating as number, comment: normalizedComment } } as const;
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
