import { routeInventory, type RouteInventoryItem } from "../routes/api-route-inventory";

const defaultApiServerUrl = "http://localhost:3000";
const json = "application/json";

type Schema = Record<string, unknown>;
type Example = Record<string, unknown> | unknown[] | string | number | boolean | null;
type BodyContract = { contentType?: string; schema: Schema; examples: Record<string, Example> };
type OperationContract = {
  summary: string;
  description: string;
  requestBody?: BodyContract;
  successStatus?: "200" | "201" | "204";
  successSchema?: Schema | null;
  successExample?: Example;
  successMessage?: string;
  paginated?: boolean;
};

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;
type ErrorExample = { code: string; details: string[]; message?: string };

const uuid = (example: string) => ({ type: "string", format: "uuid", example });
const date = (example: string) => ({ type: "string", format: "date", example });
const dateTime = (example: string) => ({ type: "string", format: "date-time", example });
const nullableString = (example: string | null = null, extra: Schema = {}) => ({ type: ["string", "null"], example, ...extra });
const arr = (items: Schema, example?: unknown[]) => ({ type: "array", items, ...(example ? { example } : {}) });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const refOrNull = (name: string) => ({ oneOf: [ref(name), { type: "null" }] });
const moduleDoc = (text: string) => `${text}\n\nCommon contract: all JSON responses use Pulih envelope. Protected routes require Bearer JWT. Validation failures return 422 with field-level details. Error messages stay safe and English.`;

const examples = {
  requestId: "req_01JZV7PULIHDEMO0000000000",
  userId: "11111111-1111-4111-8111-111111111111",
  psychologistId: "22222222-2222-4222-8222-222222222222",
  bundleId: "33333333-3333-4333-8333-333333333333",
  sessionSlotId: "44444444-4444-4444-8444-444444444444",
  bookingId: "55555555-5555-4555-8555-555555555555",
  paymentId: "66666666-6666-4666-8666-666666666666",
  fileId: "77777777-7777-4777-8777-777777777777",
  postId: "88888888-8888-4888-8888-888888888888",
  commentId: "99999999-9999-4999-8999-999999999999",
};

const schemas = {
  SuccessEnvelope: {
    type: "object",
    required: ["success", "message", "data", "meta"],
    properties: {
      success: { type: "boolean", const: true, example: true },
      message: { type: "string", example: "Request processed successfully" },
      data: { description: "Endpoint-specific payload. See operation response schema.", oneOf: [{ type: "object" }, { type: "array" }, { type: "string" }, { type: "number" }, { type: "boolean" }, { type: "null" }] },
      meta: { oneOf: [ref("PaginationMeta"), { type: "object", additionalProperties: true }, { type: "null" }], example: null },
    },
  },
  ErrorEnvelope: {
    type: "object",
    required: ["success", "message", "data", "error"],
    properties: {
      success: { type: "boolean", const: false, example: false },
      message: { type: "string", example: "Request failed" },
      data: { type: "null", example: null },
      error: {
        type: "object",
        required: ["code", "details", "request_id"],
        properties: {
          code: { type: "string", enum: ["BAD_REQUEST", "VALIDATION_ERROR", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "DOWNSTREAM_ERROR", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR"], example: "VALIDATION_ERROR" },
          details: { type: "array", items: { type: "string" }, example: ["email: Email must be valid."] },
          request_id: { type: "string", example: examples.requestId },
        },
      },
    },
  },
  PaginationMeta: {
    type: "object",
    required: ["pagination"],
    properties: {
      pagination: {
        type: "object",
        required: ["page", "limit", "total", "totalPages", "hasNextPage", "hasPrevPage"],
        properties: {
          page: { type: "integer", minimum: 1, example: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, example: 20 },
          total: { type: "integer", minimum: 0, example: 42 },
          totalPages: { type: "integer", minimum: 1, example: 3 },
          hasNextPage: { type: "boolean", example: true },
          hasPrevPage: { type: "boolean", example: false },
        },
      },
    },
  },
  AuthUser: {
    type: "object",
    required: ["id", "email", "role", "status"],
    properties: { id: uuid(examples.userId), email: { type: "string", format: "email", example: "patient@example.com" }, username: nullableString("patient1", { maxLength: 50 }), role: { type: "string", enum: ["patient", "psychologist", "admin"], example: "patient" }, status: { type: "string", example: "active" } },
  },
  UserPayload: {
    type: "object",
    required: ["id", "email", "nickname", "recovery_reason", "daily_checkin_time", "porn_free_goal", "onboarding_completed"],
    properties: { id: uuid(examples.userId), email: { type: "string", format: "email", example: "patient@example.com" }, nickname: nullableString("Demo", { maxLength: 255 }), recovery_reason: nullableString("Build a daily recovery streak", { maxLength: 2000 }), daily_checkin_time: nullableString("07:30", { pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }), porn_free_goal: { type: "integer", nullable: true, minimum: 1, maximum: 3650, example: 30 }, onboarding_completed: { type: "boolean", example: false } },
  },
  SessionPayload: {
    type: "object",
    required: ["access_token", "token_type", "expires_in"],
    properties: { access_token: { type: "string", description: "JWT access token.", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo" }, token_type: { type: "string", enum: ["Bearer"], example: "Bearer" }, expires_in: { type: "integer", example: 86400 } },
  },
  AuthTokenResponse: {
    type: "object",
    required: ["user", "session"],
    properties: { user: ref("UserPayload"), session: ref("SessionPayload") },
  },
  UserProfile: {
    type: "object",
    required: ["id", "email", "nickname", "recovery_reason", "daily_checkin_time", "porn_free_goal", "onboarding_completed"],
    properties: { id: uuid(examples.userId), email: { type: "string", format: "email", example: "patient@example.com" }, nickname: nullableString("Demo", { maxLength: 255 }), recovery_reason: nullableString("Build a daily recovery streak", { maxLength: 2000 }), daily_checkin_time: nullableString("07:30", { pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }), porn_free_goal: { type: "integer", nullable: true, minimum: 1, maximum: 3650, example: 30 }, onboarding_completed: { type: "boolean", example: false } },
  },
  OnboardingAnalysis: {
    type: "object",
    required: ["level", "title", "level_description", "pattern_analysis", "encouragement"],
    properties: { level: { type: "string", example: "Moderate" }, title: { type: "string", example: "Your Recovery Profile" }, level_description: { type: "string", example: "You show moderate dependency patterns with stress as the primary trigger." }, pattern_analysis: { type: "string", example: "Your late-night urges correlate with work stress. Consider evening grounding activities." }, encouragement: { type: "string", example: "You have already taken an important step by starting this journey." } },
  },
  OnboardingCompletion: {
    type: "object",
    required: ["id", "email", "nickname", "recovery_reason", "daily_checkin_time", "porn_free_goal", "onboarding_completed"],
    properties: { id: uuid(examples.userId), email: { type: "string", format: "email", example: "patient@example.com" }, nickname: nullableString("Demo", { maxLength: 255 }), recovery_reason: nullableString("Build a daily recovery streak", { maxLength: 2000 }), daily_checkin_time: nullableString("07:30", { pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }), porn_free_goal: { type: "integer", nullable: true, minimum: 1, maximum: 3650, example: 30 }, onboarding_completed: { type: "boolean", example: true }, onboarding_analysis: refOrNull("OnboardingAnalysis") },
  },
  PsychologistProfile: {
    type: "object",
    required: ["id", "userId", "type", "consultationChannel", "approvalStatus", "fullName", "dateOfBirth", "address", "photoUrl", "bio", "ratingSummary", "latestReviews", "latestBundle"],
    properties: { id: uuid(examples.psychologistId), userId: uuid(examples.userId), type: { type: "string", enum: ["general", "clinical"], example: "clinical" }, consultationChannel: { type: "string", enum: ["chat", "chat_and_meet"], example: "chat_and_meet" }, fullName: { type: "string", example: "Dr. Demo" }, approvalStatus: { type: "string", enum: ["draft", "pending_review", "approved", "rejected", "suspended"], example: "draft" }, dateOfBirth: { type: "string", format: "date", example: "1990-01-01" }, address: { type: "string", example: "Jl. Demo No. 1" }, photoUrl: { type: "string", format: "uri", example: "https://example.com/photo.jpg" }, bio: nullableString("Licensed clinical psychologist."), ratingSummary: { type: "object", required: ["averageRating", "reviewCount"], properties: { averageRating: { type: "number", example: 4.8 }, reviewCount: { type: "integer", example: 12 } } }, latestReviews: { type: "array", maxItems: 5, items: ref("BookingReview") }, latestBundle: refOrNull("SessionBundle") },
  },
  PsychologistSession: {
    type: "object",
    required: ["id", "bundleId", "profileId", "sessionDate", "startsAt", "endsAt", "status", "packageName", "packageDurationMinutes", "priceAmount"],
    properties: { id: uuid(examples.sessionSlotId), bundleId: uuid(examples.bundleId), profileId: uuid(examples.psychologistId), sessionDate: date("2026-06-03"), startsAt: dateTime("2026-06-03T09:00:00.000Z"), endsAt: dateTime("2026-06-03T12:00:00.000Z"), status: { type: "string", enum: ["available", "held", "booked", "completed", "cancelled", "expired", "rescheduled"], example: "available" }, heldUntil: nullableString(null, { format: "date-time" }), packageName: { type: "string", example: "Paket 3 Jam" }, packageDurationMinutes: { type: "integer", example: 180 }, priceAmount: { type: "integer", example: 150000 } },
  },
  PublicPsychologistSession: {
    type: "object",
    required: ["id", "bundleId", "profileId", "sessionDate", "startsAt", "endsAt", "status", "packageName", "packageDurationMinutes", "priceAmount", "psychologist"],
    properties: {
      id: uuid(examples.sessionSlotId),
      bundleId: uuid(examples.bundleId),
      profileId: uuid(examples.psychologistId),
      sessionDate: date("2026-06-03"),
      startsAt: dateTime("2026-06-03T09:00:00.000Z"),
      endsAt: dateTime("2026-06-03T12:00:00.000Z"),
      status: { type: "string", enum: ["available"], example: "available" },
      heldUntil: nullableString(null, { format: "date-time" }),
      packageName: { type: "string", example: "Paket 3 Jam" },
      packageDurationMinutes: { type: "integer", example: 180 },
      priceAmount: { type: "integer", example: 150000 },
      psychologist: { type: "object", required: ["id", "userId", "type", "consultationChannel", "fullName", "dateOfBirth", "address", "photoUrl", "bio", "ratingSummary", "latestReviews"], properties: { id: uuid(examples.psychologistId), userId: uuid(examples.userId), type: { type: "string", enum: ["general", "clinical"], example: "clinical" }, consultationChannel: { type: "string", enum: ["chat", "chat_and_meet"], example: "chat_and_meet" }, fullName: { type: "string", example: "Dr. Demo" }, dateOfBirth: { type: "string", format: "date", example: "1990-01-01" }, address: { type: "string", example: "Jl. Demo No. 1" }, photoUrl: { type: "string", format: "uri", example: "https://example.com/photo.jpg" }, bio: nullableString("Licensed clinical psychologist."), ratingSummary: { type: "object", required: ["averageRating", "reviewCount"], properties: { averageRating: { type: "number", example: 4.8 }, reviewCount: { type: "integer", example: 12 } } } } },
    },
  },
  BookingMessage: {
    type: "object",
    required: ["id", "bookingId", "senderUserId", "content", "createdAt"],
    properties: { id: { type: "string", example: "msg_001" }, bookingId: uuid(examples.bookingId), senderUserId: uuid(examples.userId), content: { type: "string", example: "Hello doctor" }, createdAt: dateTime("2026-07-16T01:10:00.000Z") },
  },
  BookingReview: {
    type: "object",
    required: ["id", "bookingId", "patientUserId", "psychologistProfileId", "rating", "comment", "createdAt", "updatedAt"],
    properties: { id: { type: "string", example: "review_001" }, bookingId: uuid(examples.bookingId), patientUserId: uuid(examples.userId), psychologistProfileId: uuid(examples.psychologistId), rating: { type: "integer", minimum: 1, maximum: 5, example: 5 }, comment: nullableString("Helpful", { maxLength: 2000 }), createdAt: dateTime("2026-07-16T01:10:00.000Z"), updatedAt: dateTime("2026-07-16T01:10:00.000Z") },
  },
  PaymentStatus: {
    type: "object",
    required: ["id", "bookingId", "provider", "orderId", "amount", "status", "paymentMethod", "paymentUrl", "completedAt", "expiresAt"],
    properties: { id: uuid(examples.paymentId), bookingId: uuid(examples.bookingId), provider: { type: "string", enum: ["pakasir"], example: "pakasir" }, orderId: { type: "string", example: "PLH-20260201T070000-ABCDEF12" }, amount: { type: "integer", example: 150000 }, status: { type: "string", enum: ["created", "pending", "completed", "failed", "expired", "cancelled"], example: "created" }, paymentMethod: nullableString("qris"), paymentUrl: nullableString("https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T070000-ABCDEF12", { format: "uri" }), completedAt: nullableString(null, { format: "date-time" }), expiresAt: dateTime("2026-07-16T17:00:00.000Z") },
  },
  CredentialFile: {
    type: "object",
    required: ["id", "profileId", "documentType", "fileName", "contentType", "sizeBytes"],
    properties: { id: uuid(examples.fileId), profileId: uuid(examples.psychologistId), documentType: { type: "string", enum: ["sipp", "ijazah", "str", "strpk", "sippk"], example: "str" }, fileName: { type: "string", example: "credential-str.pdf" }, contentType: { type: "string", enum: ["application/pdf", "image/jpeg", "image/png"], example: "application/pdf" }, sizeBytes: { type: "integer", maximum: 5242880, example: 248000 } },
  },
  CredentialReviewUrl: {
    type: "object",
    required: ["fileId", "reviewUrl", "expiresAt", "message"],
    properties: { fileId: uuid(examples.fileId), reviewUrl: { type: ["string", "null"], format: "uri", example: "https://example-r2-signed-url.local/credential.pdf" }, expiresAt: nullableString("2026-07-16T10:15:00.000Z", { format: "date-time" }), message: { type: "string", example: "Signed review URL is not configured. Use Cloudflare R2 dashboard/manual operations for private review." } },
  },
  SessionBundle: {
    type: "object",
    required: ["id", "profileId", "packageName", "packageDurationMinutes", "priceAmount", "dateStart", "dateEnd", "dailyStartTime", "dailyEndTime"],
    properties: { id: uuid(examples.bundleId), profileId: uuid(examples.psychologistId), packageName: { type: "string", example: "Clinical session bundle 2026-06-01 to 2026-06-07" }, packageDurationMinutes: { type: "integer", example: 180 }, priceAmount: { type: "integer", minimum: 100000, maximum: 300000, example: 150000 }, dateStart: date("2026-06-01"), dateEnd: date("2026-06-07"), dailyStartTime: { type: "string", example: "09:00:00" }, dailyEndTime: { type: "string", example: "12:00:00" } },
  },
  SessionBundleResult: {
    type: "object",
    required: ["bundle", "sessions"],
    properties: { bundle: ref("SessionBundle"), sessions: arr(ref("PsychologistSession")) },
  },
  PublicPsychologist: {
    type: "object",
    required: ["id", "userId", "type", "consultationChannel", "approvalStatus", "fullName", "dateOfBirth", "address", "photoUrl", "bio", "ratingSummary", "latestReviews", "latestBundle"],
    properties: { id: uuid(examples.psychologistId), userId: uuid(examples.userId), type: { type: "string", enum: ["general", "clinical"], example: "clinical" }, consultationChannel: { type: "string", enum: ["chat", "chat_and_meet"], example: "chat_and_meet" }, approvalStatus: { type: "string", enum: ["draft", "pending_review", "approved", "rejected", "suspended"], example: "approved" }, fullName: { type: "string", example: "Dr. Demo" }, dateOfBirth: { type: "string", format: "date", example: "1990-01-01" }, address: { type: "string", example: "Jl. Demo No. 1" }, photoUrl: { type: "string", format: "uri", example: "https://example.com/photo.jpg" }, bio: nullableString("Licensed clinical psychologist."), ratingSummary: { type: "object", required: ["averageRating", "reviewCount"], properties: { averageRating: { type: "number", example: 4.8 }, reviewCount: { type: "integer", example: 12 } } }, latestReviews: { type: "array", maxItems: 5, items: ref("BookingReview") }, latestBundle: refOrNull("SessionBundle") },
  },
  SessionSlot: {
    type: "object",
    required: ["id", "psychologistId", "bundleId", "date", "startTime", "endTime", "priceAmount", "status", "channel"],
    properties: { id: uuid(examples.sessionSlotId), psychologistId: uuid(examples.psychologistId), bundleId: uuid(examples.bundleId), date: date("2026-06-03"), startTime: { type: "string", example: "09:00:00" }, endTime: { type: "string", example: "12:00:00" }, priceAmount: { type: "integer", example: 150000 }, status: { type: "string", enum: ["available", "held", "booked"], example: "available" }, channel: { type: "string", enum: ["chat", "meet"], example: "meet" } },
  },
  Payment: {
    type: "object",
    required: ["id", "bookingId", "provider", "orderId", "amount", "status", "paymentUrl", "expiresAt", "createdAt", "updatedAt"],
    properties: { id: uuid(examples.paymentId), bookingId: uuid(examples.bookingId), provider: { type: "string", enum: ["pakasir"], example: "pakasir" }, orderId: { type: "string", example: "PLH-20260201T070000-ABCDEF12" }, amount: { type: "integer", example: 150000 }, status: { type: "string", enum: ["created", "pending", "completed", "failed", "expired", "cancelled"], example: "created" }, paymentMethod: nullableString("qris"), paymentUrl: nullableString("https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T070000-ABCDEF12", { format: "uri" }), completedAt: nullableString(null, { format: "date-time" }), expiresAt: dateTime("2026-07-16T17:00:00.000Z"), createdAt: dateTime("2026-07-16T16:00:00.000Z"), updatedAt: dateTime("2026-07-16T16:00:00.000Z") },
  },
  Booking: {
    type: "object",
    required: ["id", "patientUserId", "psychologistProfileId", "psychologistUserId", "sessionSlotId", "consultationChannel", "status", "scheduledStartAt", "scheduledEndAt", "priceAmount", "packageNameSnapshot", "packageDurationMinutesSnapshot", "paymentExpiresAt", "complaint", "createdAt", "updatedAt", "psychologistType", "patientEmail", "psychologistEmail", "psychologistFullName", "ratingSummary", "latestReviews"],
    properties: {
      id: uuid(examples.bookingId),
      patientUserId: uuid(examples.userId),
      psychologistProfileId: uuid(examples.psychologistId),
      psychologistUserId: uuid(examples.userId),
      sessionSlotId: uuid(examples.sessionSlotId),
      consultationChannel: { type: "string", enum: ["chat", "chat_and_meet"], example: "chat_and_meet" },
      status: { type: "string", enum: ["draft", "pending_payment", "payment_completed", "confirmed", "reschedule_requested", "rescheduled", "cancelled", "expired", "completed", "no_show"], example: "pending_payment" },
      scheduledStartAt: dateTime("2026-06-03T08:00:00.000Z"),
      scheduledEndAt: dateTime("2026-06-03T11:00:00.000Z"),
      priceAmount: { type: "integer", example: 150000 },
      packageNameSnapshot: { type: "string", example: "Paket 3 Jam" },
      packageDurationMinutesSnapshot: { type: "integer", example: 180 },
      paymentExpiresAt: dateTime("2026-06-03T09:00:00.000Z"),
      meetLink: nullableString(null, { format: "uri" }),
      confirmedAt: nullableString(null, { format: "date-time" }),
      rescheduledAt: nullableString(null, { format: "date-time" }),
      rescheduleReason: nullableString(null, { maxLength: 2000 }),
      complaint: { type: "string", maxLength: 500, example: "Sulit tidur dan mudah cemas." },
      createdAt: dateTime("2026-06-03T08:00:00.000Z"),
      updatedAt: dateTime("2026-06-03T08:00:00.000Z"),
      psychologistType: { type: "string", enum: ["general", "clinical"], example: "clinical" },
      patientEmail: { type: "string", format: "email", example: "patient@example.com" },
      psychologistEmail: { type: "string", format: "email", example: "psych@example.com" },
      psychologistFullName: { type: "string", example: "Dr. Psych" },
      ratingSummary: { type: "object", required: ["averageRating", "reviewCount"], properties: { averageRating: { type: "number", example: 4.8 }, reviewCount: { type: "integer", example: 12 } } },
      latestReviews: { type: "array", maxItems: 5, items: ref("BookingReview") },
    },
  },
  BookingCreateResult: {
    type: "object",
    required: ["booking", "payment", "paymentUrl", "instruction"],
    properties: { booking: ref("Booking"), payment: ref("Payment"), paymentUrl: { type: "string", format: "uri", example: "https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T070000-ABCDEF12" }, instruction: { type: "string", example: "Pay via Pakasir using the link above." } },
  },
  CheckIn: {
    type: "object",
    required: ["id", "user_id", "check_in_date", "check_in_day_name", "mood", "is_successful", "commitment", "relapse_trigger", "created_at"],
    properties: {
      id: uuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      user_id: uuid(examples.userId),
      check_in_date: date("2026-07-16"),
      check_in_day_name: { type: "string", example: "Rabu" },
      mood: { type: "string", maxLength: 50, example: "tenang" },
      is_successful: { type: "boolean", example: true },
      commitment: nullableString("Feeling better today."),
      relapse_trigger: arr({ type: "string" }, []),
      created_at: dateTime("2026-07-16T01:00:00.000Z"),
    },
  },
  Relapse: {
    type: "object",
    required: ["id", "user_id", "relapse_date", "relapse_day_name", "mood", "commitment", "relapse_trigger", "check_in_id", "created_at"],
    properties: {
      id: uuid("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      user_id: uuid(examples.userId),
      relapse_date: date("2026-07-16"),
      relapse_day_name: { type: "string", example: "Rabu" },
      mood: { type: "string", maxLength: 50, example: "cemas" },
      commitment: nullableString("Late-night stress."),
      relapse_trigger: arr({ type: "string", maxLength: 500 }, ["stress", "late-night scrolling"]),
      check_in_id: nullableString(null, { format: "uuid" }),
      created_at: dateTime("2026-07-16T01:00:00.000Z"),
    },
  },
  RoutineStatistics: {
    type: "object",
    required: ["current_streak", "longest_streak", "total_checkins", "total_attempts", "success_rate", "streak_calendar", "relapse_calendar", "relapse_count", "relapse_rate", "recovery_success_rate", "checkin_consistency_score", "weekly_progress", "monthly_progress", "mood_trend", "last_check_in_date", "last_check_in_day_name", "last_relapse_date", "last_relapse_day_name", "weekday_summary", "streak_goal_comparison"],
    properties: {
      current_streak: { type: "integer", example: 7 },
      longest_streak: { type: "integer", example: 14 },
      total_checkins: { type: "integer", example: 21 },
      total_attempts: { type: "integer", example: 23 },
      success_rate: { type: "number", example: 0.91 },
      streak_calendar: arr({ type: "string", format: "date" }, ["2026-07-10", "2026-07-11"]),
      relapse_calendar: arr({ type: "string", format: "date" }, ["2026-07-09"]),
      relapse_count: { type: "integer", example: 2 },
      relapse_rate: { type: "number", example: 0.09 },
      recovery_success_rate: { type: "number", example: 0.91 },
      checkin_consistency_score: { type: "number", example: 0.67 },
      weekly_progress: {
        type: "object",
        required: ["window_days", "current_successful_checkins", "previous_successful_checkins", "delta", "delta_rate"],
        properties: {
          window_days: { type: "integer", example: 7 },
          current_successful_checkins: { type: "integer", example: 5 },
          previous_successful_checkins: { type: "integer", example: 4 },
          delta: { type: "integer", example: 1 },
          delta_rate: { type: "number", example: 0.25 },
        },
      },
      monthly_progress: {
        type: "object",
        required: ["window_days", "current_successful_checkins", "previous_successful_checkins", "delta", "delta_rate"],
        properties: {
          window_days: { type: "integer", example: 30 },
          current_successful_checkins: { type: "integer", example: 18 },
          previous_successful_checkins: { type: "integer", example: 15 },
          delta: { type: "integer", example: 3 },
          delta_rate: { type: "number", example: 0.2 },
        },
      },
      mood_trend: arr({
        type: "object",
        required: ["date", "day_name", "dominant_mood", "successful_ratio"],
        properties: {
          date: date("2026-07-16"),
          day_name: { type: "string", example: "Rabu" },
          dominant_mood: { type: "string", example: "tenang" },
          successful_ratio: { type: "number", example: 1 },
        },
      }),
      last_check_in_date: nullableString("2026-07-16", { format: "date" }),
      last_check_in_day_name: nullableString("Rabu"),
      last_relapse_date: nullableString("2026-07-09", { format: "date" }),
      last_relapse_day_name: nullableString("Sabtu"),
      weekday_summary: arr({
        type: "object",
        required: ["day_name", "successful_checkins", "relapse_count", "total_checkins", "success_rate"],
        properties: {
          day_name: { type: "string", example: "Senin" },
          successful_checkins: { type: "integer", example: 2 },
          relapse_count: { type: "integer", example: 1 },
          total_checkins: { type: "integer", example: 3 },
          success_rate: { type: "number", example: 0.67 },
        },
      }),
      streak_goal_comparison: {
        type: "object",
        required: ["porn_free_goal", "current_streak", "longest_streak", "goal_reached", "remaining_days", "progress_rate"],
        properties: {
          porn_free_goal: { type: "integer", nullable: true, example: 90 },
          current_streak: { type: "integer", example: 7 },
          longest_streak: { type: "integer", example: 14 },
          goal_reached: { type: "boolean", example: false },
          remaining_days: { type: "integer", nullable: true, example: 83 },
          progress_rate: { type: "number", example: 0.08 },
        },
      },
    },
  },
  Journal: {
    type: "object",
    required: ["id", "userId", "content", "createdAt", "updatedAt"],
    properties: { id: uuid("cccccccc-cccc-4ccc-8ccc-cccccccccccc"), userId: uuid(examples.userId), content: { type: "string", maxLength: 5000, example: "Today I stayed consistent." }, createdAt: dateTime("2026-07-16T01:00:00.000Z"), updatedAt: dateTime("2026-07-16T01:00:00.000Z") },
  },
  CommunityPostAuthor: {
    type: "object",
    required: ["nickname", "currentStreak"],
    properties: { nickname: { type: "string", example: "Demo" }, currentStreak: { type: "integer", example: 7 } },
  },
  CommunityPost: {
    type: "object",
    required: ["id", "userId", "category", "content", "likeCount", "commentCount", "createdAt", "updatedAt", "author"],
    properties: { id: uuid(examples.postId), userId: uuid(examples.userId), title: nullableString("My Recovery Story"), category: { type: "string", enum: ["advice", "motivation", "story", "question", "help"], example: "story" }, content: { type: "string", minLength: 10, maxLength: 5000, example: "I kept my routine today and it feels amazing." }, likeCount: { type: "integer", example: 3 }, commentCount: { type: "integer", example: 2 }, createdAt: dateTime("2026-07-16T01:00:00.000Z"), updatedAt: dateTime("2026-07-16T01:30:00.000Z"), author: ref("CommunityPostAuthor") },
  },
  CommunityComment: {
    type: "object",
    required: ["id", "postId", "userId", "content", "depth", "replyCount", "createdAt"],
    properties: { id: uuid(examples.commentId), postId: uuid(examples.postId), userId: uuid(examples.userId), parentCommentId: nullableString(null, { format: "uuid" }), content: { type: "string", maxLength: 2000, example: "You are not alone." }, depth: { type: "integer", example: 0 }, replyCount: { type: "integer", example: 1 }, createdAt: dateTime("2026-07-16T01:10:00.000Z") },
  },
  CommunityCommentNode: {
    type: "object",
    required: ["id", "postId", "userId", "content", "depth", "replyCount", "createdAt", "replies"],
    properties: { id: uuid(examples.commentId), postId: uuid(examples.postId), userId: uuid(examples.userId), parentCommentId: nullableString(null, { format: "uuid" }), content: { type: "string", maxLength: 2000, example: "Thanks for sharing!" }, depth: { type: "integer", example: 0 }, replyCount: { type: "integer", example: 1 }, createdAt: dateTime("2026-07-16T01:10:00.000Z"), replies: { type: "array", items: { $ref: "#/components/schemas/CommunityCommentNode" }, example: [] } },
  },
  CommunityThread: {
    type: "object",
    required: ["postId", "comments"],
    properties: { postId: uuid(examples.postId), comments: arr(ref("CommunityCommentNode")) },
  },
  ToggleLike: {
    type: "object",
    required: ["likedCount", "isLiked"],
    properties: { likedCount: { type: "integer", example: 4 }, isLiked: { type: "boolean", example: true } },
  },
  DailyChallengePayload: {
    type: "object",
    required: ["title", "description"],
    properties: { title: { type: "string", example: "Five-minute grounding" }, description: { type: "string", example: "Pause, breathe, and name five things you can see." } },
  },
  EducationContent: {
    type: "object",
    required: ["id", "title", "url", "category", "type"],
    properties: { id: { type: "string", example: "edu_001" }, title: { type: "string", example: "Understanding Triggers" }, description: nullableString("Short guide to noticing recovery triggers."), url: { type: "string", format: "uri", example: "https://pulih.app/education/understanding-triggers" }, thumbnail_url: nullableString(null, { format: "uri" }), category: { type: "string", example: "Recovery Basics" }, type: { type: "string", enum: ["artikel", "video"], example: "artikel" }, published_at: nullableString("2026-07-16T00:00:00.000Z", { format: "date-time" }) },
  },
  DailyContent: {
    type: "object",
    required: ["date", "motivation", "challenge", "physicalChallenge"],
    properties: { date: date("2026-07-16"), motivation: { type: "string", example: "Small steps still count." }, challenge: ref("DailyChallengePayload"), physicalChallenge: ref("DailyChallengePayload") },
  },
  Achievement: {
    type: "object",
    required: ["id", "name", "description", "target"],
    properties: { id: { type: "string", example: "first_checkin" }, name: { type: "string", example: "First Check-in" }, description: { type: "string", example: "Complete your first daily check-in." }, target: { type: "integer", example: 1 } },
  },
  AchievementProgress: {
    type: "object",
    required: ["achievementId", "progress", "target", "unlockedAt"],
    properties: { achievementId: { type: "string", example: "first_checkin" }, progress: { type: "integer", example: 1 }, target: { type: "integer", example: 1 }, unlockedAt: nullableString("2026-07-16T01:00:00.000Z", { format: "date-time" }) },
  },
  AskCoachResponse: {
    type: "object",
    required: ["response", "persona_used"],
    properties: { response: { type: "string", example: "Try one small safe step. Pause and breathe." }, persona_used: { type: "string", enum: ["supportive", "friendly", "concise", "direct"], example: "supportive" } },
  },
  RelapseSolutionResponse: {
    type: "object",
    required: ["title", "analysis", "summary"],
    properties: { title: { type: "string", example: "Regain Focus Now" }, analysis: { type: "string", example: "Primary trigger emerges during stress and quick access to triggering content." }, summary: { type: "string", example: "Best solution right now: cut off trigger access when urge rises, do quick emotional stabilization, then switch to a safe alternative activity." } },
  },
  OnboardingAnalysisResponse: {
    type: "object",
    required: ["level", "title", "level_description", "pattern_analysis", "encouragement"],
    properties: { level: { type: "string", enum: ["Low", "Moderate", "High"], example: "Moderate" }, title: { type: "string", example: "Building Consistency" }, level_description: { type: "string", example: "You need steady light-touch support patterns." }, pattern_analysis: { type: "string", example: "Answers show good motivation but rhythm is not yet stable." }, encouragement: { type: "string", example: "Keep small daily steps. Your progress is already good." } },
  },
  PersonaPreferencesResponse: {
    type: "object",
    required: ["persona", "fallback_persona"],
    properties: { persona: { type: "string", enum: ["supportive", "friendly", "concise", "direct"], example: "supportive" }, fallback_persona: { type: "string", enum: ["supportive", "friendly", "concise", "direct"], example: "supportive" } },
  },
  ChatHistoryItem: {
    type: "object",
    required: ["id", "role", "content", "createdAt"],
    properties: { id: { type: "string", example: "chat_001" }, role: { type: "string", enum: ["user", "assistant"], example: "user" }, content: { type: "string", example: "I feel an urge right now." }, createdAt: { type: "string", format: "date-time", example: "2026-07-16T01:00:00.000Z" } },
  },
  AiSummaryResponse: {
    type: "object",
    required: ["summary"],
    properties: { summary: { type: "string", example: "You checked in consistently this week. Keep your evening routine strong." } },
  },
  RelapsePreventionPlan: {
    type: "object",
    required: ["delay", "distract", "decide", "raw"],
    properties: { delay: { type: "string", example: "Wait 10 minutes before acting on the urge." }, distract: { type: "string", example: "Do a grounding activity for a few minutes." }, decide: { type: "string", example: "Choose the safest next step and contact support if needed." }, raw: { type: "string", example: "delay: Wait 10 minutes before acting on the urge.\ndistract: Do a grounding activity for a few minutes." } },
  },
  PaymentWebhookResult: {
    type: "object",
    required: ["paymentId", "bookingId", "status", "idempotent"],
    properties: { paymentId: uuid(examples.paymentId), bookingId: uuid(examples.bookingId), status: { type: "string", example: "completed" }, idempotent: { type: "boolean", example: false } },
  },
  ValidationDemoResult: {
    type: "object",
    required: ["name", "email"],
    properties: { name: { type: "string", example: "Pulih Demo" }, email: { type: "string", format: "email", example: "demo@example.com" } },
  },
  CheckInResponse: {
    type: "object",
    required: ["check_in", "statistics", "relapse_solution"],
    properties: {
      check_in: ref("CheckIn"),
      statistics: ref("RoutineStatistics"),
      relapse_solution: { type: "null", example: null },
    },
  },
  RelapseResponse: {
    type: "object",
    required: ["relapse", "statistics", "relapse_solution"],
    properties: {
      relapse: ref("Relapse"),
      statistics: ref("RoutineStatistics"),
      relapse_solution: {
        type: "object",
        required: ["title", "analysis", "summary", "generated_at"],
        properties: {
          title: { type: "string", example: "Quick Recovery Steps" },
          analysis: { type: "string", example: "Relapse detected with mood anxious. Current trigger pattern: stress." },
          summary: { type: "string", example: "Best immediate action: cut off access to the trigger now, stabilize your emotions briefly, then switch to a pre-planned safe activity." },
          generated_at: dateTime("2026-07-16T01:00:00.000Z"),
        },
      },
    },
  },
  ActivitySummary: {
    type: "object",
    required: ["window_days", "successful_checkins", "relapses", "active_days", "recent_activity"],
    properties: {
      window_days: { type: "integer", example: 30 },
      successful_checkins: { type: "integer", example: 18 },
      relapses: { type: "integer", example: 3 },
      active_days: { type: "integer", example: 21 },
      recent_activity: arr({
        type: "object",
        required: ["date", "day_name", "type"],
        properties: {
          date: date("2026-07-16"),
          day_name: { type: "string", example: "Rabu" },
          type: { type: "string", enum: ["checkin_success", "checkin_relapse", "relapse", "journal"], example: "checkin_success" },
          mood: { type: "string", example: "tenang" },
        },
      }),
    },
  },
  RelapseStatistics: {
    type: "object",
    required: ["statistics", "relapses", "hourly_relapse_distribution", "relapse_triggers_distribution", "peak_relapse_hours_utc", "peak_relapse_count", "ai_summary", "relapse_time_summary", "relapse_trigger_summary"],
    properties: {
      statistics: ref("RoutineStatistics"),
      relapses: arr(ref("Relapse")),
      hourly_relapse_distribution: arr({
        type: "object",
        required: ["hour_utc", "relapse_count"],
        properties: { hour_utc: { type: "integer", example: 21 }, relapse_count: { type: "integer", example: 3 } },
      }),
      relapse_triggers_distribution: arr({
        type: "object",
        required: ["relapse_trigger", "relapse_trigger_count"],
        properties: { relapse_trigger: { type: "string", example: "stres kerja" }, relapse_trigger_count: { type: "integer", example: 5 } },
      }),
      peak_relapse_hours_utc: arr({ type: "integer" }, [21, 22]),
      peak_relapse_count: { type: "integer", example: 3 },
      ai_summary: { type: "string", example: "New insights for you will be available soon. Keep writing your daily journal!" },
      relapse_time_summary: {
        type: "object",
        required: ["title", "analysis", "summary", "generated_at"],
        properties: {
          title: { type: "string", example: "Relapse Time Analysis" },
          analysis: { type: "string", example: "Relapse pattern shows peak at UTC hours: 21:00." },
          summary: { type: "string", example: "Most frequent trigger: work stress." },
          generated_at: dateTime("2026-07-16T01:00:00.000Z"),
        },
      },
      relapse_trigger_summary: {
        oneOf: [{
          type: "object",
          required: ["title", "analysis", "summary", "generated_at"],
          properties: {
            title: { type: "string", example: "Quick Recovery Steps" },
            analysis: { type: "string", example: "Relapse detected with mood anxious. Current trigger pattern: work stress." },
            summary: { type: "string", example: "Best immediate action: cut off access to the trigger now, stabilize your emotions briefly, then switch to a pre-planned safe activity." },
            generated_at: dateTime("2026-07-16T01:00:00.000Z"),
          },
        }, { type: "null" }],
      },
    },
  },
} as const;

const schemaExamples: Record<string, Example> = {
  AuthUser: { id: examples.userId, email: "patient@example.com", username: "patient1", role: "patient", status: "active" },
  AuthTokenResponse: { user: { id: examples.userId, email: "patient@example.com", nickname: null, recovery_reason: null, daily_checkin_time: null, porn_free_goal: null, onboarding_completed: false }, session: { access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo", token_type: "Bearer", expires_in: 86400 } },
  UserProfile: { id: examples.userId, email: "patient@example.com", nickname: "Demo", recovery_reason: "Build a daily recovery streak", daily_checkin_time: "07:30", porn_free_goal: 30, onboarding_completed: false },
  OnboardingCompletion: { id: examples.userId, email: "patient@example.com", nickname: "Demo", recovery_reason: "Build a daily recovery streak", daily_checkin_time: "07:30", porn_free_goal: 30, onboarding_completed: true, onboarding_analysis: { level: "Moderate", title: "Your Recovery Profile", level_description: "You show moderate dependency patterns with stress as the primary trigger.", pattern_analysis: "Your late-night urges correlate with work stress. Consider evening grounding activities.", encouragement: "You have already taken an important step by starting this journey." } },
  PsychologistProfile: { id: examples.psychologistId, userId: examples.userId, type: "clinical", consultationChannel: "chat_and_meet", fullName: "Dr. Demo", approvalStatus: "draft", dateOfBirth: "1990-01-01", address: "Jl. Demo No. 1", photoUrl: "https://example.com/photo.jpg", bio: "Licensed clinical psychologist.", ratingSummary: { averageRating: 4.8, reviewCount: 12 }, latestReviews: [{ id: "review_001", bookingId: examples.bookingId, patientUserId: examples.userId, psychologistProfileId: examples.psychologistId, rating: 5, comment: "Helpful", createdAt: "2026-07-16T01:10:00.000Z", updatedAt: "2026-07-16T01:10:00.000Z" }], latestBundle: null },
  CredentialFile: { id: examples.fileId, profileId: examples.psychologistId, documentType: "str", fileName: "credential-str.pdf", contentType: "application/pdf", sizeBytes: 248000 },
  CredentialReviewUrl: { fileId: examples.fileId, reviewUrl: null, expiresAt: null, message: "Signed review URL is not configured. Use Cloudflare R2 dashboard/manual operations for private review." },
  SessionBundle: { id: examples.bundleId, profileId: examples.psychologistId, packageName: "Clinical session bundle 2026-06-01 to 2026-06-07", packageDurationMinutes: 180, priceAmount: 150000, dateStart: "2026-06-01", dateEnd: "2026-06-07", dailyStartTime: "09:00:00", dailyEndTime: "12:00:00" },
  SessionBundleResult: { bundle: { id: examples.bundleId, profileId: examples.psychologistId, packageName: "Clinical session bundle 2026-06-01 to 2026-06-07", packageDurationMinutes: 180, priceAmount: 150000, dateStart: "2026-06-01", dateEnd: "2026-06-07", dailyStartTime: "09:00:00", dailyEndTime: "12:00:00" }, sessions: [{ id: examples.sessionSlotId, bundleId: examples.bundleId, profileId: examples.psychologistId, sessionDate: "2026-06-03", startsAt: "2026-06-03T09:00:00.000Z", endsAt: "2026-06-03T12:00:00.000Z", status: "available", heldUntil: null, packageName: "Paket 3 Jam", packageDurationMinutes: 180, priceAmount: 150000 }] },
  PublicPsychologist: { id: examples.psychologistId, userId: examples.userId, type: "clinical", consultationChannel: "chat_and_meet", approvalStatus: "approved", fullName: "Dr. Demo", dateOfBirth: "1990-01-01", address: "Jl. Demo No. 1", photoUrl: "https://example.com/photo.jpg", bio: "Licensed clinical psychologist.", ratingSummary: { averageRating: 4.8, reviewCount: 12 }, latestReviews: [{ id: "review_001", bookingId: examples.bookingId, patientUserId: examples.userId, psychologistProfileId: examples.psychologistId, rating: 5, comment: "Helpful", createdAt: "2026-07-16T01:10:00.000Z", updatedAt: "2026-07-16T01:10:00.000Z" }], latestBundle: null },
  PsychologistSession: { id: examples.sessionSlotId, bundleId: examples.bundleId, profileId: examples.psychologistId, sessionDate: "2026-06-03", startsAt: "2026-06-03T09:00:00.000Z", endsAt: "2026-06-03T12:00:00.000Z", status: "available", heldUntil: null, packageName: "Paket 3 Jam", packageDurationMinutes: 180, priceAmount: 150000 },
  PublicPsychologistSession: { id: examples.sessionSlotId, bundleId: examples.bundleId, profileId: examples.psychologistId, sessionDate: "2026-06-03", startsAt: "2026-06-03T09:00:00.000Z", endsAt: "2026-06-03T12:00:00.000Z", status: "available", heldUntil: null, packageName: "Paket 3 Jam", packageDurationMinutes: 180, priceAmount: 150000, psychologist: { id: examples.psychologistId, userId: examples.userId, type: "clinical", consultationChannel: "chat_and_meet", fullName: "Dr. Demo", dateOfBirth: "1990-01-01", address: "Jl. Demo No. 1", photoUrl: "https://example.com/photo.jpg", bio: "Licensed clinical psychologist.", ratingSummary: { averageRating: 4.8, reviewCount: 12 }, latestReviews: [{ id: "review_001", bookingId: examples.bookingId, patientUserId: examples.userId, psychologistProfileId: examples.psychologistId, rating: 5, comment: "Helpful", createdAt: "2026-07-16T01:10:00.000Z", updatedAt: "2026-07-16T01:10:00.000Z" }] } },
  BookingMessage: { id: "msg_001", bookingId: examples.bookingId, senderUserId: examples.userId, content: "Hello doctor", createdAt: "2026-07-16T01:10:00.000Z" },
  BookingReview: { id: "review_001", bookingId: examples.bookingId, patientUserId: examples.userId, psychologistProfileId: examples.psychologistId, rating: 5, comment: "Helpful", createdAt: "2026-07-16T01:10:00.000Z", updatedAt: "2026-07-16T01:10:00.000Z" },
  PaymentStatus: { id: examples.paymentId, bookingId: examples.bookingId, provider: "pakasir", orderId: "PLH-20260201T070000-ABCDEF12", amount: 150000, status: "created", paymentMethod: null, paymentUrl: "https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T070000-ABCDEF12", completedAt: null, expiresAt: "2026-07-16T17:00:00.000Z" },
  Payment: { id: examples.paymentId, bookingId: examples.bookingId, provider: "pakasir", orderId: "PLH-20260201T070000-ABCDEF12", amount: 150000, status: "created", paymentMethod: null, paymentUrl: "https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T070000-ABCDEF12", completedAt: null, expiresAt: "2026-07-16T17:00:00.000Z", createdAt: "2026-07-16T16:00:00.000Z", updatedAt: "2026-07-16T16:00:00.000Z" },
  SessionSlot: { id: examples.sessionSlotId, psychologistId: examples.psychologistId, bundleId: examples.bundleId, date: "2026-06-03", startTime: "09:00:00", endTime: "12:00:00", priceAmount: 150000, status: "available", channel: "meet" },
  Booking: { id: examples.bookingId, patientUserId: examples.userId, psychologistProfileId: examples.psychologistId, psychologistUserId: examples.userId, sessionSlotId: examples.sessionSlotId, consultationChannel: "chat_and_meet", status: "pending_payment", scheduledStartAt: "2026-06-03T08:00:00.000Z", scheduledEndAt: "2026-06-03T11:00:00.000Z", priceAmount: 150000, packageNameSnapshot: "Paket 3 Jam", packageDurationMinutesSnapshot: 180, paymentExpiresAt: "2026-06-03T09:00:00.000Z", complaint: "Sulit tidur dan mudah cemas.", meetLink: null, confirmedAt: null, rescheduledAt: null, rescheduleReason: null, createdAt: "2026-06-03T08:00:00.000Z", updatedAt: "2026-06-03T08:00:00.000Z", psychologistType: "clinical", patientEmail: "patient@example.com", psychologistEmail: "psych@example.com", psychologistFullName: "Dr. Psych", ratingSummary: { averageRating: 4.8, reviewCount: 12 }, latestReviews: [{ id: "review_001", bookingId: examples.bookingId, patientUserId: examples.userId, psychologistProfileId: examples.psychologistId, rating: 5, comment: "Helpful", createdAt: "2026-07-16T01:10:00.000Z", updatedAt: "2026-07-16T01:10:00.000Z" }] },
  CheckIn: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user_id: examples.userId, check_in_date: "2026-07-16", check_in_day_name: "Rabu", mood: "tenang", is_successful: true, commitment: "Feeling better today.", relapse_trigger: [], created_at: "2026-07-16T01:00:00.000Z" },
  Relapse: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", user_id: examples.userId, relapse_date: "2026-07-16", relapse_day_name: "Rabu", mood: "cemas", commitment: "Late-night stress.", relapse_trigger: ["stress", "late-night scrolling"], check_in_id: null, created_at: "2026-07-16T01:00:00.000Z" },
  RoutineStatistics: { current_streak: 7, longest_streak: 14, total_checkins: 21, total_attempts: 23, success_rate: 0.91, streak_calendar: ["2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"], relapse_calendar: ["2026-07-09"], relapse_count: 2, relapse_rate: 0.09, recovery_success_rate: 0.91, checkin_consistency_score: 0.67, weekly_progress: { window_days: 7, current_successful_checkins: 7, previous_successful_checkins: 5, delta: 2, delta_rate: 0.4 }, monthly_progress: { window_days: 30, current_successful_checkins: 21, previous_successful_checkins: 18, delta: 3, delta_rate: 0.17 }, mood_trend: [{ date: "2026-07-16", day_name: "Rabu", dominant_mood: "tenang", successful_ratio: 1 }], last_check_in_date: "2026-07-16", last_check_in_day_name: "Rabu", last_relapse_date: "2026-07-09", last_relapse_day_name: "Sabtu", weekday_summary: [{ day_name: "Senin", successful_checkins: 3, relapse_count: 0, total_checkins: 3, success_rate: 1 }], streak_goal_comparison: { porn_free_goal: 90, current_streak: 7, longest_streak: 14, goal_reached: false, remaining_days: 83, progress_rate: 0.08 } },
  Journal: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", userId: examples.userId, content: "Today I stayed consistent.", createdAt: "2026-07-16T01:00:00.000Z", updatedAt: "2026-07-16T01:00:00.000Z" },
  CommunityPost: { id: examples.postId, userId: examples.userId, title: "My Recovery Story", category: "story", content: "I kept my routine today and it feels amazing.", likeCount: 3, commentCount: 2, createdAt: "2026-07-16T01:00:00.000Z", updatedAt: "2026-07-16T01:30:00.000Z", author: { nickname: "Demo", currentStreak: 7 } },
  CommunityComment: { id: examples.commentId, postId: examples.postId, userId: examples.userId, parentCommentId: null, content: "You are not alone.", depth: 0, replyCount: 1, createdAt: "2026-07-16T01:10:00.000Z" },
  CommunityThread: { postId: examples.postId, comments: [{ id: examples.commentId, postId: examples.postId, userId: examples.userId, parentCommentId: null, content: "You are not alone.", depth: 0, replyCount: 1, createdAt: "2026-07-16T01:10:00.000Z", replies: [] }] },
  ToggleLike: { likedCount: 4, isLiked: true },
  EducationContent: { id: "edu_001", title: "Understanding Triggers", description: "Short guide to noticing recovery triggers.", url: "https://pulih.app/education/understanding-triggers", thumbnail_url: null, category: "Recovery Basics", type: "artikel", published_at: "2026-07-16T00:00:00.000Z" },
  DailyContent: { date: "2026-07-16", motivation: "Small steps still count.", challenge: { title: "Five-minute grounding", description: "Pause, breathe, and name five things you can see." }, physicalChallenge: { title: "Morning Stretch", description: "Stretch your entire body for 10 minutes after waking up." } },
  Achievement: { id: "first_checkin", name: "First Check-in", description: "Complete your first daily check-in.", target: 1 },
  AchievementProgress: { achievementId: "first_checkin", progress: 1, target: 1, unlockedAt: "2026-07-16T01:00:00.000Z" },
  AskCoachResponse: { response: "Try one small safe step. Pause and breathe.", persona_used: "supportive" },
  RelapseSolutionResponse: { title: "Regain Focus Now", analysis: "Primary trigger emerges during stress and quick access to triggering content.", summary: "Best solution right now: cut off trigger access when urge rises, do quick emotional stabilization, then switch to a safe alternative activity." },
  OnboardingAnalysisResponse: { level: "Moderate", title: "Building Consistency", level_description: "You need steady light-touch support patterns.", pattern_analysis: "Answers show good motivation but rhythm is not yet stable.", encouragement: "Keep small daily steps. Your progress is already good." },
  PersonaPreferencesResponse: { persona: "supportive", fallback_persona: "supportive" },
  ChatHistoryItem: { id: "chat_001", role: "user", content: "I feel an urge right now.", createdAt: "2026-07-16T01:00:00.000Z" },
  AiSummaryResponse: { summary: "You checked in consistently this week. Keep your evening routine strong." },
  RelapsePreventionPlan: { delay: "Wait 10 minutes before acting on the urge.", distract: "Do a grounding activity for a few minutes.", decide: "Choose the safest next step and contact support if needed.", raw: "delay: Wait 10 minutes before acting on the urge.\ndistract: Do a grounding activity for a few minutes.\ndecide: Choose the safest next step and contact support if needed." },
  PaymentWebhookResult: { paymentId: examples.paymentId, bookingId: examples.bookingId, status: "completed", idempotent: false },
  ValidationDemoResult: { name: "Pulih Demo", email: "demo@example.com" },
  CheckInResponse: { check_in: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", user_id: examples.userId, check_in_date: "2026-07-16", check_in_day_name: "Rabu", mood: "tenang", is_successful: true, commitment: "Feeling better today.", relapse_trigger: [], created_at: "2026-07-16T01:00:00.000Z" }, statistics: { current_streak: 7, longest_streak: 14, total_checkins: 21, total_attempts: 23, success_rate: 0.91, streak_calendar: ["2026-07-16"], relapse_calendar: [], relapse_count: 2, relapse_rate: 0.09, recovery_success_rate: 0.91, checkin_consistency_score: 0.67, weekly_progress: { window_days: 7, current_successful_checkins: 7, previous_successful_checkins: 5, delta: 2, delta_rate: 0.4 }, monthly_progress: { window_days: 30, current_successful_checkins: 21, previous_successful_checkins: 18, delta: 3, delta_rate: 0.17 }, mood_trend: [], last_check_in_date: "2026-07-16", last_check_in_day_name: "Rabu", last_relapse_date: null, last_relapse_day_name: null, weekday_summary: [], streak_goal_comparison: { porn_free_goal: 90, current_streak: 7, longest_streak: 14, goal_reached: false, remaining_days: 83, progress_rate: 0.08 } }, relapse_solution: null },
  RelapseResponse: { relapse: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", user_id: examples.userId, relapse_date: "2026-07-16", relapse_day_name: "Rabu", mood: "cemas", commitment: "Late-night stress.", relapse_trigger: ["stress"], check_in_id: null, created_at: "2026-07-16T01:00:00.000Z" }, statistics: { current_streak: 0, longest_streak: 14, total_checkins: 20, total_attempts: 22, success_rate: 0.91, streak_calendar: ["2026-07-15"], relapse_calendar: ["2026-07-16"], relapse_count: 3, relapse_rate: 0.13, recovery_success_rate: 0.87, checkin_consistency_score: 0.6, weekly_progress: { window_days: 7, current_successful_checkins: 6, previous_successful_checkins: 5, delta: 1, delta_rate: 0.2 }, monthly_progress: { window_days: 30, current_successful_checkins: 20, previous_successful_checkins: 18, delta: 2, delta_rate: 0.11 }, mood_trend: [], last_check_in_date: "2026-07-15", last_check_in_day_name: "Selasa", last_relapse_date: "2026-07-16", last_relapse_day_name: "Rabu", weekday_summary: [], streak_goal_comparison: { porn_free_goal: 90, current_streak: 0, longest_streak: 14, goal_reached: false, remaining_days: 90, progress_rate: 0 } }, relapse_solution: { title: "Quick Recovery Steps", analysis: "Relapse detected with mood anxious. Current trigger pattern: stress.", summary: "Best immediate action: cut off access to the trigger now, stabilize your emotions briefly, then switch to a pre-planned safe activity.", generated_at: "2026-07-16T01:00:00.000Z" } },
  ActivitySummary: { window_days: 30, successful_checkins: 18, relapses: 3, active_days: 21, recent_activity: [{ date: "2026-07-16", day_name: "Rabu", type: "checkin_success", mood: "tenang" }] },
  RelapseStatistics: { statistics: { current_streak: 0, longest_streak: 14, total_checkins: 20, total_attempts: 22, success_rate: 0.91, streak_calendar: ["2026-07-15"], relapse_calendar: ["2026-07-16"], relapse_count: 2, relapse_rate: 0.09, recovery_success_rate: 0.91, checkin_consistency_score: 0.6, weekly_progress: { window_days: 7, current_successful_checkins: 6, previous_successful_checkins: 5, delta: 1, delta_rate: 0.2 }, monthly_progress: { window_days: 30, current_successful_checkins: 20, previous_successful_checkins: 18, delta: 2, delta_rate: 0.11 }, mood_trend: [], last_check_in_date: "2026-07-15", last_check_in_day_name: "Selasa", last_relapse_date: "2026-07-16", last_relapse_day_name: "Rabu", weekday_summary: [], streak_goal_comparison: { porn_free_goal: 90, current_streak: 0, longest_streak: 14, goal_reached: false, remaining_days: 90, progress_rate: 0 } }, relapses: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", user_id: examples.userId, relapse_date: "2026-07-16", relapse_day_name: "Rabu", mood: "cemas", commitment: null, relapse_trigger: ["stres kerja"], check_in_id: null, created_at: "2026-07-16T01:00:00.000Z" }], hourly_relapse_distribution: [{ hour_utc: 21, relapse_count: 1 }], relapse_triggers_distribution: [{ relapse_trigger: "stres kerja", relapse_trigger_count: 1 }], peak_relapse_hours_utc: [21], peak_relapse_count: 1, ai_summary: "New insights for you will be available soon. Keep writing your daily journal!", relapse_time_summary: { title: "Relapse Time Analysis", analysis: "Relapse pattern shows peak at UTC hours: 21:00.", summary: "Most frequent trigger: work stress.", generated_at: "2026-07-16T01:00:00.000Z" }, relapse_trigger_summary: { title: "Quick Recovery Steps", analysis: "Relapse detected with mood anxious. Current trigger pattern: work stress.", summary: "Best immediate action: cut off access to the trigger now, stabilize your emotions briefly, then switch to a pre-planned safe activity.", generated_at: "2026-07-16T01:00:00.000Z" } },
};

function successData(schemaName: keyof typeof schemaExamples) {
  return { successSchema: ref(String(schemaName)), successExample: schemaExamples[String(schemaName)] };
}
function successArray(schemaName: keyof typeof schemaExamples) {
  return { successSchema: arr(ref(String(schemaName))), successExample: [schemaExamples[String(schemaName)]] };
}
function body(schema: Schema, examplesMap: Record<string, Example>, contentType = json): BodyContract {
  return { contentType, schema, examples: examplesMap };
}
function operationKey(method: string, path: string) {
  return `${method.toUpperCase()} ${path}`;
}

const requestSchemas = {
  Register: { type: "object", additionalProperties: false, required: ["email", "username", "password", "confirm_password"], properties: { email: { type: "string", format: "email", example: "patient@example.com" }, username: { type: "string", minLength: 3, maxLength: 50, pattern: "^[a-z0-9_]{3,50}$", example: "patient1" }, password: { type: "string", minLength: 1, maxLength: 72, format: "password", example: "password123" }, confirm_password: { type: "string", minLength: 1, format: "password", example: "password123" } } },
  Login: { type: "object", additionalProperties: false, required: ["identifier", "password"], properties: { identifier: { type: "string", example: "patient@example.com" }, password: { type: "string", minLength: 1, maxLength: 72, format: "password", example: "password123" } } },
  Onboarding: { type: "object", additionalProperties: false, required: ["nickname", "recovery_reason", "daily_checkin_time", "porn_free_goal"], properties: { nickname: { type: "string", minLength: 1, maxLength: 255, example: "Demo" }, recovery_reason: { type: "string", minLength: 3, maxLength: 2000, example: "Build a daily recovery streak" }, daily_checkin_time: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", example: "07:30" }, porn_free_goal: { type: "integer", minimum: 1, maximum: 3650, example: 30 }, answers: { type: "object", additionalProperties: true, example: { trigger: "stress" } }, dependency_level: nullableString("Moderate", { maxLength: 64 }) } },
  UserSettings: { type: "object", additionalProperties: false, properties: { nickname: nullableString("Demo", { maxLength: 255 }), recovery_reason: nullableString("Stay sober for 30 days", { maxLength: 2000 }), daily_checkin_time: nullableString("07:30", { pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }), porn_free_goal: { type: "integer", nullable: true, minimum: 1, maximum: 3650, example: 30 } } },
  PsychologistProfile: { type: "object", additionalProperties: false, required: ["type", "fullName", "dateOfBirth", "address", "photoUrl"], properties: { type: { type: "string", enum: ["general", "clinical"], example: "clinical" }, fullName: { type: "string", maxLength: 255, example: "Dr. Demo" }, dateOfBirth: { type: "string", format: "date", example: "1990-01-01" }, address: { type: "string", maxLength: 1000, example: "Jl. Demo No. 1" }, photoUrl: { type: "string", format: "uri", maxLength: 2000, example: "https://example.com/photo.jpg" }, bio: nullableString("Licensed clinical psychologist.", { maxLength: 2000 }) } },
  CredentialUpload: { type: "object", required: ["file", "documentType"], properties: { file: { type: "string", format: "binary", description: "PDF/JPG/JPEG/PNG credential file, max 5 MB." }, documentType: { type: "string", enum: ["sipp", "ijazah", "str", "strpk", "sippk"], example: "str" } } },
  SessionBundle: { type: "object", additionalProperties: false, required: ["dateStart", "dateEnd", "dailyStartTime", "dailyEndTime", "priceAmount"], properties: { dateStart: date("2026-06-01"), dateEnd: date("2026-06-07"), dailyStartTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$", example: "09:00" }, dailyEndTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$", example: "12:00" }, priceAmount: { type: "number", minimum: 100000, maximum: 300000, example: 150000 } } },
  BookingCreate: { type: "object", additionalProperties: false, required: ["sessionSlotId", "complaint"], properties: { sessionSlotId: uuid(examples.sessionSlotId), complaint: { type: "string", minLength: 1, maxLength: 500, example: "Sulit tidur dan mudah cemas." } } },
  BookingConfirm: { type: "object", additionalProperties: false, properties: { meetLink: nullableString("https://meet.google.com/abc-defg-hij", { format: "uri", description: "Required only for clinical psychologist meet sessions." }) } },
  BookingMessage: { type: "object", additionalProperties: false, required: ["content"], properties: { content: { type: "string", minLength: 1, maxLength: 2000, example: "Hello doctor" } } },
  BookingReview: { type: "object", additionalProperties: false, required: ["rating"], properties: { rating: { type: "integer", minimum: 1, maximum: 5, example: 5 }, comment: nullableString("Helpful", { maxLength: 2000 }) } },
  BookingReschedule: { type: "object", additionalProperties: false, required: ["newSessionSlotId", "reason"], properties: { newSessionSlotId: uuid("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"), reason: { type: "string", maxLength: 2000, example: "Doctor requested a new time" } } },
  PakasirWebhook: { type: "object", additionalProperties: false, required: ["project", "order_id", "amount", "status"], properties: { project: { type: "string", example: "pulih-demo" }, order_id: { type: "string", example: "order_123" }, amount: { type: "number", minimum: 1, example: 150000 }, status: { type: "string", example: "completed" }, payment_method: nullableString("bank_transfer"), completed_at: nullableString("2026-07-16T16:00:00.000Z", { format: "date-time" }) } },
  CheckIn: { type: "object", additionalProperties: false, required: ["mood", "is_successful"], properties: { mood: { type: "string", maxLength: 50, example: "tenang" }, is_successful: { type: "boolean", example: true }, commitment: nullableString("Feeling better today.", { maxLength: 2000 }), content: nullableString(null, { maxLength: 2000, description: "Alias for commitment" }), localDate: nullableString("2026-07-16", { format: "date", description: "Optional. Defaults to Asia/Jakarta today." }) } },
  Relapse: { type: "object", additionalProperties: false, required: ["mood", "relapse_trigger"], properties: { mood: { type: "string", maxLength: 50, example: "cemas" }, relapse_trigger: { type: "array", minItems: 1, items: { type: "string", maxLength: 500 }, example: ["stress"] }, commitment: nullableString("Late-night stress.", { maxLength: 2000 }), content: nullableString(null, { maxLength: 2000, description: "Alias for commitment" }), localDate: nullableString("2026-07-16", { format: "date", description: "Optional. Defaults to Asia/Jakarta today." }) } },
  Journal: { type: "object", additionalProperties: false, required: ["content"], properties: { content: { type: "string", minLength: 1, maxLength: 5000, example: "Today I stayed consistent." } } },
  CommunityPost: { type: "object", additionalProperties: false, required: ["category", "content"], properties: { title: nullableString("My Recovery Story", { maxLength: 120 }), category: { type: "string", enum: ["advice", "motivation", "story", "question", "help"], example: "story" }, content: { type: "string", minLength: 10, maxLength: 5000, example: "I kept my routine today and it feels amazing." } } },
  CommunityComment: { type: "object", additionalProperties: false, required: ["content"], properties: { content: { type: "string", minLength: 1, maxLength: 2000, example: "You are not alone." } } },
  CommunityReply: { type: "object", additionalProperties: false, required: ["content"], properties: { content: { type: "string", minLength: 1, maxLength: 2000, example: "How did it go?" } } },
  AskCoach: { type: "object", additionalProperties: false, required: ["message"], properties: { message: { type: "string", minLength: 1, maxLength: 4000, example: "I feel triggered after work." } } },
  RelapseSolution: { type: "object", additionalProperties: false, required: ["mood"], properties: { mood: { type: "string", minLength: 1, maxLength: 50, example: "stressed" }, relapse_trigger: { type: "array", maxItems: 10, items: { type: "string", maxLength: 500 }, example: ["work pressure"] }, commitment: { type: "string", maxLength: 4000, example: "Late-night stress." } } },
  RelapsePreventionPlan: { type: "object", additionalProperties: false, required: ["urgeLevel"], properties: { urgeLevel: { type: "integer", minimum: 1, maximum: 5, example: 4 }, triggers: { type: "array", maxItems: 10, items: { type: "string", maxLength: 120 }, example: ["stress"] }, currentContext: nullableString("At home at night.", { maxLength: 1000 }) } },
  OnboardingAnalysis: { type: "object", additionalProperties: false, required: ["answers"], properties: { answers: { type: "object", minProperties: 1, additionalProperties: true, example: { reason: "Better focus", goal: 30 } } } },
  PersonaPreferences: { type: "object", additionalProperties: false, required: ["persona"], properties: { persona: { type: "string", enum: ["supportive", "friendly", "concise", "direct"], example: "supportive" } } },
  ValidationDemo: { type: "object", additionalProperties: false, required: ["name", "email"], properties: { name: { type: "string", example: "Pulih Demo" }, email: { type: "string", format: "email", example: "demo@example.com" } } },
};

const contracts: Record<string, OperationContract> = {
  "GET /health/live": { summary: "Check service liveness", description: moduleDoc("Returns process liveness for uptime checks. Does not verify DB connectivity."), successSchema: { type: "object", required: ["status"], properties: { status: { type: "string", example: "ok" } } }, successExample: { status: "ok" }, successMessage: "Service is live" },
  "GET /health/ready": { summary: "Check service readiness", description: moduleDoc("Checks DB readiness for runtime dependency probes."), successSchema: { type: "object", required: ["status"], properties: { status: { type: "string", example: "ok" } } }, successExample: { status: "ok" }, successMessage: "Service is ready" },
  "POST /validation-demo": { summary: "Validate request body demo", description: moduleDoc("Small validation route used to demonstrate standard validation errors and envelope format."), requestBody: body(requestSchemas.ValidationDemo, { valid: { name: "Pulih Demo", email: "demo@example.com" }, invalid: { name: "Pulih Demo", email: "not-an-email" } }), successSchema: ref("ValidationDemoResult"), successExample: schemaExamples.ValidationDemoResult, successMessage: "Validation demo accepted" },
  "GET /openapi.yaml": { summary: "Serve OpenAPI YAML", description: moduleDoc("Human-readable OpenAPI 3.1 document for docs and external tooling."), successSchema: { type: "string" }, successExample: "openapi: 3.1.0\ninfo:\n  title: Pulih API\n", successMessage: "OpenAPI document retrieved successfully" },
  "GET /openapi.json": { summary: "Serve OpenAPI JSON", description: moduleDoc("Machine-readable OpenAPI 3.1 JSON document used by Scalar."), successSchema: { type: "object", additionalProperties: true }, successExample: { openapi: "3.1.0", info: { title: "Pulih API" } }, successMessage: "OpenAPI document retrieved successfully" },
  "GET /docs/api": { summary: "Render Scalar API docs", description: moduleDoc("Interactive Scalar API reference with search, grouped modules, request examples, response examples, auth helper, and code samples."), successSchema: { type: "string" }, successExample: "<html>...</html>", successMessage: "API docs rendered successfully" },
  "GET /docs/api/": { summary: "Render Scalar API docs", description: moduleDoc("Trailing-slash variant of the interactive Scalar API reference."), successSchema: { type: "string" }, successExample: "<html>...</html>", successMessage: "API docs rendered successfully" },
  "POST /api/v1/auth/register": { summary: "Register patient account", description: moduleDoc("Creates a patient account with email, username and password. Returns user profile and access token. Duplicate email or username returns 409."), requestBody: body(requestSchemas.Register, { patient: { email: "patient@example.com", username: "patient1", password: "password123", confirm_password: "password123" } }), successStatus: "201", successMessage: "Registration successful", successSchema: ref("AuthTokenResponse"), successExample: schemaExamples.AuthTokenResponse },
  "POST /api/v1/auth/register/psychologist": { summary: "Register psychologist account", description: moduleDoc("Creates a psychologist auth account with email, username and password. Continue with /psychologists/register to complete type-specific professional profile and credentials."), requestBody: body(requestSchemas.Register, { psychologist: { email: "psychologist@example.com", username: "psychologist1", password: "password123", confirm_password: "password123" } }), successStatus: "201", successMessage: "Psychologist registration successful", successSchema: ref("AuthTokenResponse"), successExample: schemaExamples.AuthTokenResponse },
  "POST /api/v1/auth/login": { summary: "Login with email or username", description: moduleDoc("Authenticates user by identifier (email or username) and password. Returns user profile and Bearer access token. Invalid credentials return 401."), requestBody: body(requestSchemas.Login, { patient: { identifier: "patient@example.com", password: "password123" }, psychologist: { identifier: "psychologist@example.com", password: "password123" } }), successMessage: "Login successful", successSchema: ref("AuthTokenResponse"), successExample: schemaExamples.AuthTokenResponse },
  "POST /api/v1/auth/logout": { summary: "Logout current client", description: moduleDoc("Access-token-only MVP logout. Client discards token; server returns null data."), successMessage: "Logout successful", successSchema: { type: "null" }, successExample: null },
  "GET /api/v1/auth/me": { summary: "Read authenticated user", description: moduleDoc("Returns authenticated principal from Bearer token."), successMessage: "Authenticated user retrieved successfully", ...successData("AuthUser") },
  "POST /api/v1/auth/onboarding": { summary: "Complete onboarding", description: moduleDoc("Stores recovery onboarding data for current user. Returns onboarding analysis when AI is available. Same payload is idempotent; different payload after completion returns 409."), requestBody: body(requestSchemas.Onboarding, { complete: { nickname: "Demo", recovery_reason: "Build a daily recovery streak", daily_checkin_time: "07:30", porn_free_goal: 30, answers: { trigger: "stress" }, dependency_level: "Moderate" } }), successMessage: "Onboarding completed successfully", successSchema: ref("OnboardingCompletion"), successExample: schemaExamples.OnboardingCompletion },
  "GET /api/v1/users/me": { summary: "Read current user profile", description: moduleDoc("Returns current user's profile and onboarding fields."), successMessage: "Current user retrieved successfully", ...successData("UserProfile") },
  "PUT /api/v1/users/settings": { summary: "Update current user settings", description: moduleDoc("Updates editable current-user settings. Unknown fields return 422."), requestBody: body(requestSchemas.UserSettings, { profile: { nickname: "Demo", recovery_reason: "Stay sober for 30 days", daily_checkin_time: "07:30", porn_free_goal: 60 } }), successMessage: "Settings updated successfully", ...successData("UserProfile") },
  "POST /api/v1/psychologists/register": { summary: "Create or update psychologist profile", description: moduleDoc("Creates psychologist profile shell with identity fields for psychologist listing and booking."), requestBody: body(requestSchemas.PsychologistProfile, { clinical: { type: "clinical", fullName: "Dr. Demo", dateOfBirth: "1990-01-01", address: "Jl. Demo No. 1", photoUrl: "https://example.com/photo.jpg", bio: "Licensed clinical psychologist." }, general: { type: "general", fullName: "Konselor Demo", dateOfBirth: "1991-01-01", address: "Jl. Demo No. 2", photoUrl: "https://example.com/photo2.jpg", bio: "General counseling support." } }), successStatus: "201", successMessage: "Psychologist profile saved successfully", ...successData("PsychologistProfile") },
  "GET /api/v1/psychologists/me": { summary: "Read psychologist profile", description: moduleDoc("Returns current authenticated psychologist profile, including draft/review status."), successMessage: "Request processed successfully", ...successData("PsychologistProfile") },
  "PUT /api/v1/psychologists/me": { summary: "Update psychologist profile", description: moduleDoc("Updates current psychologist profile before or during review."), requestBody: body(requestSchemas.PsychologistProfile, { clinical: { type: "clinical", fullName: "Dr. Demo", dateOfBirth: "1990-01-01", address: "Jl. Demo No. 1", photoUrl: "https://example.com/photo.jpg", bio: "Updated bio." } }), successMessage: "Psychologist profile updated successfully", ...successData("PsychologistProfile") },
  "POST /api/v1/psychologists/me/credential-file": { summary: "Upload psychologist credential file", description: moduleDoc("Uploads private credential file. Allowed: PDF/JPG/JPEG/PNG, max 5 MB. Required docs differ by psychologist type."), requestBody: body(requestSchemas.CredentialUpload, { clinical_str: { documentType: "str", file: "credential-str.pdf" } }, "multipart/form-data"), successStatus: "201", successMessage: "Credential file uploaded successfully", ...successData("CredentialFile") },
  "POST /api/v1/psychologists/me/submit-for-review": { summary: "Submit psychologist profile for review", description: moduleDoc("Validates required profile fields and credential file metadata, then moves profile to pending_review for manual ops approval."), successMessage: "Psychologist profile submitted for review", ...successData("PsychologistProfile") },
  "GET /api/v1/psychologists/me/credential-file/:fileId/review-url": { summary: "Create credential review URL", description: moduleDoc("Returns short-lived private review URL or fallback metadata for authenticated owner."), successMessage: "Request processed successfully", ...successData("CredentialReviewUrl") },
  "POST /api/v1/psychologists/me/bundles": { summary: "Create session bundle", description: moduleDoc("Creates bundle using local dates/times and generates session slots. Price must be Rp100.000–Rp300.000."), requestBody: body(requestSchemas.SessionBundle, { weekly: { dateStart: "2026-06-01", dateEnd: "2026-06-07", dailyStartTime: "09:00", dailyEndTime: "12:00", priceAmount: 150000 } }), successStatus: "201", successMessage: "Session bundle created successfully", successSchema: ref("SessionBundleResult"), successExample: { bundle: schemaExamples.SessionBundle, sessions: [schemaExamples.PsychologistSession] } },
  "PUT /api/v1/psychologists/me/bundles/:bundleId": { summary: "Update session bundle", description: moduleDoc("Updates owned bundle and regenerated session availability according to service rules."), requestBody: body(requestSchemas.SessionBundle, { weekly: { dateStart: "2026-06-01", dateEnd: "2026-06-07", dailyStartTime: "10:00", dailyEndTime: "12:00", priceAmount: 175000 } }), successMessage: "Session bundle updated successfully", successSchema: ref("SessionBundleResult"), successExample: { bundle: schemaExamples.SessionBundle, sessions: [schemaExamples.PsychologistSession] } },
  "DELETE /api/v1/psychologists/me/bundles/:bundleId": { summary: "Delete session bundle", description: moduleDoc("Deletes owned bundle when allowed. Booked slots return conflict."), successMessage: "Session bundle deleted successfully", successSchema: { type: "object", required: ["deleted"], properties: { deleted: { type: "boolean", example: true }, bundleId: uuid(examples.bundleId) } }, successExample: { deleted: true, bundleId: examples.bundleId } },
  "GET /api/v1/psychologists": { summary: "List approved psychologists", description: moduleDoc("Returns public directory of manually approved psychologists."), successMessage: "Request processed successfully", ...successArray("PublicPsychologist") },
  "GET /api/v1/psychologists/:psychologistId": { summary: "Read approved psychologist detail", description: moduleDoc("Returns public profile for approved psychologist. Draft/rejected profiles are hidden."), successMessage: "Request processed successfully", ...successData("PublicPsychologist") },
  "GET /api/v1/psychologists/:psychologistId/sessions": { summary: "List generated sessions", description: moduleDoc("Returns public available session slots generated from one approved psychologist."), successMessage: "Request processed successfully", successSchema: arr(ref("PsychologistSession")), successExample: [schemaExamples.PsychologistSession] },
  "GET /api/v1/psychologist-sessions": { summary: "List all available psychologist sessions", description: moduleDoc("Returns all available session slots from approved psychologists with nested public psychologist summary. Use this endpoint when the client wants one global browse list."), successMessage: "Psychologist sessions retrieved successfully", successSchema: arr(ref("PublicPsychologistSession")), successExample: [schemaExamples.PublicPsychologistSession] },
  "POST /api/v1/bookings": { summary: "Create booking", description: moduleDoc("Creates pending-payment booking, claims session slot, creates Pakasir payment URL, and sets 1-hour expiry."), requestBody: body(requestSchemas.BookingCreate, { slot: { sessionSlotId: examples.sessionSlotId, complaint: "Sulit tidur dan mudah cemas." } }), successStatus: "201", successMessage: "Booking created successfully", successSchema: ref("BookingCreateResult"), successExample: { booking: schemaExamples.Booking, payment: schemaExamples.Payment, paymentUrl: "https://app.pakasir.com/pay/pulih/150000?order_id=PLH-20260201T070000-ABCDEF12", instruction: "Pay via Pakasir using the link above." } },
  "GET /api/v1/bookings": { summary: "List my bookings", description: moduleDoc("Lists bookings visible to current patient or psychologist."), successMessage: "Bookings retrieved successfully", ...successArray("Booking") },
  "GET /api/v1/bookings/:bookingId": { summary: "Read booking detail", description: moduleDoc("Returns booking detail if current user is patient owner or assigned psychologist."), successMessage: "Booking retrieved successfully", ...successData("Booking") },
  "POST /api/v1/bookings/:bookingId/confirm": { summary: "Confirm paid booking", description: moduleDoc("Psychologist confirms paid booking. Clinical sessions require meet link; general sessions remain chat-only."), requestBody: body(requestSchemas.BookingConfirm, { clinical: { meetLink: "https://meet.google.com/abc-defg-hij" }, general: { meetLink: null } }), successMessage: "Booking confirmed successfully", ...successData("Booking") },
  "POST /api/v1/bookings/:bookingId/complete": { summary: "Complete booking", description: moduleDoc("Assigned psychologist marks confirmed or rescheduled booking as completed so patient can submit review."), successMessage: "Booking completed successfully", ...successData("Booking") },
  "GET /api/v1/bookings/:bookingId/messages": { summary: "List booking messages", description: moduleDoc("Returns booking chat messages for booking patient or assigned psychologist. Chat is available only after payment completion or later."), successMessage: "Booking messages retrieved successfully", successSchema: arr(ref("BookingMessage")), successExample: [schemaExamples.BookingMessage] },
  "POST /api/v1/bookings/:bookingId/messages": { summary: "Create booking message", description: moduleDoc("Creates booking chat message for booking patient or assigned psychologist. Chat is available only after payment completion or later."), requestBody: body(requestSchemas.BookingMessage, { message: { content: "Hello doctor" } }), successStatus: "201", successMessage: "Booking message created successfully", ...successData("BookingMessage") },
  "POST /api/v1/bookings/:bookingId/review": { summary: "Create booking review", description: moduleDoc("Creates one patient review after booking is completed. Rating must be 1-5."), requestBody: body(requestSchemas.BookingReview, { review: { rating: 5, comment: "Helpful" } }), successStatus: "201", successMessage: "Booking review created successfully", ...successData("BookingReview") },
  "POST /api/v1/bookings/:bookingId/reschedule": { summary: "Reschedule booking", description: moduleDoc("Psychologist moves booking to new generated slot with reason. MVP applies immediately without patient approval."), requestBody: body(requestSchemas.BookingReschedule, { new_slot: { newSessionSlotId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", reason: "Doctor requested a new time" } }), successMessage: "Booking rescheduled successfully", ...successData("Booking") },
  "GET /api/v1/payments/:paymentId/status": { summary: "Read payment status", description: moduleDoc("Returns safe payment status for owner only. No provider metadata or secrets are exposed."), successMessage: "Payment status retrieved successfully", ...successData("PaymentStatus") },
  "POST /api/v1/payments/pakasir/webhook": { summary: "Process Pakasir webhook", description: moduleDoc("Validates webhook body, verifies order/project/amount through service logic, and idempotently updates payment + booking status."), requestBody: body(requestSchemas.PakasirWebhook, { completed: { project: "pulih-demo", order_id: "order_123", amount: 150000, status: "completed", payment_method: "bank_transfer", completed_at: "2026-07-16T16:00:00.000Z" } }), successMessage: "Payment webhook processed successfully", ...successData("PaymentWebhookResult") },
  "POST /api/v1/routine/checkin": { summary: "Create routine check-in", description: moduleDoc("Stores one daily check-in using Asia/Jakarta local date semantics. is_successful must be true. Use relapse endpoint for unsuccessful days."), requestBody: body(requestSchemas.CheckIn, { today: { mood: "tenang", is_successful: true, commitment: "Feeling better today.", localDate: "2026-07-16" } }), successMessage: "Check-in saved successfully", ...successData("CheckInResponse") },
  "POST /api/v1/routine/relapses": { summary: "Create relapse event", description: moduleDoc("Records relapse event with mood, triggers, optional commitment, and local date. Links to same-day check-in if exists. Each user can record one relapse per local date."), requestBody: body(requestSchemas.Relapse, { event: { mood: "cemas", relapse_trigger: ["stress", "late-night scrolling"], commitment: "Late-night stress.", localDate: "2026-07-16" } }), successMessage: "Relapse recorded successfully", ...successData("RelapseResponse") },
  "GET /api/v1/routine/statistics": { summary: "Read routine statistics", description: moduleDoc("Returns full routine statistics: streak, check-in, relapse, mood trend, weekly/monthly progress, weekday summary, and streak goal comparison."), successMessage: "Routine statistics retrieved successfully", ...successData("RoutineStatistics") },
  "GET /api/v1/routine/statistics/activity-summary": { summary: "Read routine activity summary", description: moduleDoc("Returns periodic activity timeline with recent check-in, relapse, and journal events. Supports optional window_days query param (7-90, default 30)."), successMessage: "Routine activity summary retrieved successfully", successSchema: ref("ActivitySummary"), successExample: schemaExamples.ActivitySummary },
  "GET /api/v1/routine/relapses": { summary: "List relapse events", description: moduleDoc("Returns current user's relapse history with full detail including check_in_id linking."), successMessage: "Relapses retrieved successfully", successSchema: arr(ref("Relapse")), successExample: [schemaExamples.Relapse] },
  "GET /api/v1/routine/relapses/statistics": { summary: "Read relapse statistics", description: moduleDoc("Returns complete relapse statistics with hourly UTC distribution, trigger distribution, peak hours, AI summary placeholder, and time/trigger analysis."), successMessage: "Relapse statistics retrieved successfully", successSchema: ref("RelapseStatistics"), successExample: schemaExamples.RelapseStatistics },
  "GET /api/v1/journals": { summary: "List private journals", description: moduleDoc("Returns private journal entries for current user only."), successMessage: "Journals retrieved successfully", ...successArray("Journal") },
  "POST /api/v1/journals": { summary: "Create private journal", description: moduleDoc("Creates private journal entry. Journal content is sensitive and owner-only."), requestBody: body(requestSchemas.Journal, { reflection: { content: "Today I stayed consistent." } }), successStatus: "201", successMessage: "Journal created successfully", ...successData("Journal") },
  "GET /api/v1/community": { summary: "List community posts", description: moduleDoc("Returns community post feed with author info. Optional category filter: advice, motivation, story, question, help."), successMessage: "Community posts retrieved successfully", ...successArray("CommunityPost") },
  "POST /api/v1/community": { summary: "Create community post", description: moduleDoc("Creates community post with optional title. Categories: advice, motivation, story, question, help. Content: 10-5000 chars. MVP moderation is lightweight; keep content safe."), requestBody: body(requestSchemas.CommunityPost, { story: { title: "My Recovery Story", category: "story", content: "I kept my routine today and it feels amazing." } }), successStatus: "201", successMessage: "Community post created successfully", ...successData("CommunityPost") },
  "GET /api/v1/community/:postId/comments": { summary: "List comment thread", description: moduleDoc("Returns threaded comments for a community post with max depth 2. Root comments limited to 200."), successMessage: "Community comments retrieved successfully", ...successData("CommunityThread") },
  "POST /api/v1/community/:postId/comments": { summary: "Create community comment", description: moduleDoc("Adds top-level comment (depth=0) to a community post. Content max 2000 chars."), requestBody: body(requestSchemas.CommunityComment, { support: { content: "You are not alone." } }), successStatus: "201", successMessage: "Community comment created successfully", ...successData("CommunityComment") },
  "POST /api/v1/community/:postId/comments/:commentId/replies": { summary: "Create reply to comment", description: moduleDoc("Adds reply to existing comment. Max thread depth is 2. Parent comment must belong to same post. Returns 422 if depth exceeded or cross-post reply."), requestBody: body(requestSchemas.CommunityReply, { reply: { content: "How did it go?" } }), successStatus: "201", successMessage: "Community reply created successfully", ...successData("CommunityComment") },
  "POST /api/v1/community/:postId/like": { summary: "Toggle like on post", description: moduleDoc("Toggles like/unlike for current user on post. Returns updated like count and current like state."), successMessage: "Community post like toggled", ...successData("ToggleLike") },
  "GET /api/v1/education": { summary: "List education content", description: moduleDoc("Returns active education content sorted by title. Each item includes type (artikel/video), url, optional thumbnail, and category."), successMessage: "Education content retrieved successfully", ...successArray("EducationContent") },
  "GET /api/v1/content/daily": { summary: "Read daily content", description: moduleDoc("Returns deterministic daily motivation, mental challenge, and physical challenge using UTC-based rotation with fallback."), successMessage: "Daily content retrieved successfully", ...successData("DailyContent") },
  "GET /api/v1/achievements/catalog": { summary: "List achievement catalog", description: moduleDoc("Returns achievement definitions used by progress tracking."), successMessage: "Achievement catalog retrieved successfully", ...successArray("Achievement") },
  "GET /api/v1/achievements/progress": { summary: "Read achievement progress", description: moduleDoc("Returns achievement progress for current user."), successMessage: "Achievement progress retrieved successfully", ...successArray("AchievementProgress") },
  "GET /api/v1/achievements/unlocked": { summary: "List unlocked achievements", description: moduleDoc("Returns achievements already unlocked by current user."), successMessage: "Unlocked achievements retrieved successfully", ...successArray("AchievementProgress") },
  "POST /api/v1/ai/ask-coach": { summary: "Ask AI coach", description: moduleDoc("Generates non-streaming supportive response with active persona. Does not diagnose, replace professional help, or expose raw sensitive data in errors."), requestBody: body(requestSchemas.AskCoach, { support: { message: "I feel triggered after work." } }), successMessage: "AI coach response generated successfully", ...successData("AskCoachResponse") },
  "POST /api/v1/ai/relapse-solution": { summary: "Ask AI relapse solution", description: moduleDoc("Analyzes relapse mood and triggers. Returns structured analysis with title, trigger analysis, and best-solution summary."), requestBody: body(requestSchemas.RelapseSolution, { support: { mood: "stressed", relapse_trigger: ["work pressure"], commitment: "Late-night stress." } }), successMessage: "Relapse solution generated successfully", ...successData("RelapseSolutionResponse") },
  "POST /api/v1/ai/relapse-prevention-plan": { summary: "Create relapse prevention plan", description: moduleDoc("Returns structured delay, distract, and decide guidance with safety boundary copy."), requestBody: body(requestSchemas.RelapsePreventionPlan, { plan: { urgeLevel: 4, triggers: ["stress"], currentContext: "At home at night." } }), successMessage: "Relapse prevention plan generated successfully", ...successData("RelapsePreventionPlan") },
  "GET /api/v1/ai/chat-history": { summary: "Read AI chat history", description: moduleDoc("Returns current user's AI conversation history only. Optional limit query param (1-200, default 50)."), successMessage: "AI chat history retrieved successfully", successSchema: arr(ref("ChatHistoryItem")), successExample: [schemaExamples.ChatHistoryItem] },
  "GET /api/v1/ai/summary": { summary: "Read AI summary", description: moduleDoc("Returns AI-generated summary based on recent chat history."), successMessage: "AI summary retrieved successfully", ...successData("AiSummaryResponse") },
  "POST /api/v1/ai/onboarding-analysis": { summary: "Analyze onboarding data", description: moduleDoc("Analyzes onboarding answers and returns structured dependency level classification with guidance."), requestBody: body(requestSchemas.OnboardingAnalysis, { analysis: { answers: { reason: "Better focus", goal: 30 } } }), successMessage: "Onboarding analysis generated successfully", ...successData("OnboardingAnalysisResponse") },
  "GET /api/v1/ai/persona-preferences": { summary: "Read AI persona preferences", description: moduleDoc("Returns current user's AI persona with fallback default."), successMessage: "AI persona preferences retrieved successfully", ...successData("PersonaPreferencesResponse") },
  "PUT /api/v1/ai/persona-preferences": { summary: "Update AI persona preferences", description: moduleDoc("Updates current user's AI persona preference. Allowed: supportive, friendly, concise, direct."), requestBody: body(requestSchemas.PersonaPreferences, { supportive: { persona: "supportive" }, direct: { persona: "direct" } }), successMessage: "AI persona preferences updated successfully", ...successData("PersonaPreferencesResponse") },
};

function toOpenApiPath(path: string) {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}
function toOperationId(method: RouteInventoryItem["method"], path: string) {
  return `${method.toLowerCase()}_${path.replace(/^\//, "").replace(/[:/{}-]/g, "_").replace(/__+/g, "_")}`.replace(/_+$/g, "");
}
function getTag(path: string) {
  if (path.startsWith("/health") || path.startsWith("/validation-demo") || path.startsWith("/docs") || path.startsWith("/openapi")) return "platform";
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "api" && segments[1] === "v1") return segments[2] ?? "misc";
  return segments[0] ?? "misc";
}
function pathParameters(path: string) {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map(([, name]) => ({ name, in: "path" as const, required: true, schema: uuid(`${name}_uuid`), description: `Route parameter: ${name}.` }));
}
function successEnvelopeSchema(dataSchema: Schema | null | undefined, paginated = false) {
  return { type: "object", required: ["success", "message", "data", "meta"], properties: { success: { type: "boolean", const: true }, message: { type: "string" }, data: dataSchema ?? { type: "null" }, meta: paginated ? ref("PaginationMeta") : { oneOf: [ref("PaginationMeta"), { type: "object", additionalProperties: true }, { type: "null" }] } } };
}

const errorSummary: Record<ErrorStatus, string> = {
  400: "Bad request",
  401: "Unauthenticated",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  422: "Validation error",
  429: "Rate limited",
  500: "Internal error",
  502: "Downstream error",
  503: "Service unavailable",
};

function errorExample(code: string, details: string[], message?: string) {
  return { success: false, message: message ?? "Request failed", data: null, error: { code, details, request_id: examples.requestId } };
}

function errorResponse(status: ErrorStatus, example: ErrorExample) {
  return {
    description: errorSummary[status],
    content: {
      [json]: {
        schema: ref("ErrorEnvelope"),
        examples: {
          default: {
            summary: errorSummary[status],
            value: errorExample(example.code, example.details, example.message),
          },
        },
      },
    },
  };
}

function getErrorStatusList(item: RouteInventoryItem): ErrorStatus[] {
  if (item.path === "/health/live") return [500];
  if (item.path === "/health/ready") return [503, 500];
  if (item.path === "/validation-demo") return [400, 422, 500];
  if (item.path === "/openapi.yaml" || item.path === "/openapi.json" || item.path === "/docs/api" || item.path === "/docs/api/") return [500];

  if (item.path.startsWith("/api/v1/auth/")) {
    if (item.path === "/api/v1/auth/register" || item.path === "/api/v1/auth/register/psychologist") return [400, 409, 422, 429, 500];
    if (item.path === "/api/v1/auth/login") return [400, 401, 422, 429, 500];
    if (item.path === "/api/v1/auth/logout") return [401, 500];
    if (item.path === "/api/v1/auth/me") return [401, 500];
    if (item.path === "/api/v1/auth/onboarding") return [401, 422, 500];
  }

  if (item.path.startsWith("/api/v1/users/")) {
    if (item.path === "/api/v1/users/me") return [401, 404, 500];
    if (item.path === "/api/v1/users/settings") return [401, 422, 500];
  }

  if (item.path.startsWith("/api/v1/psychologists/")) {
    if (item.path === "/api/v1/psychologists") return [500];
    if (item.path === "/api/v1/psychologists/:psychologistId") return [404, 422, 500];
    if (item.path === "/api/v1/psychologists/:psychologistId/sessions") return [404, 422, 500];
    if (item.path === "/api/v1/psychologists/register") return [401, 403, 409, 422, 500];
    if (item.path === "/api/v1/psychologists/me") return [401, 403, 404, 409, 422, 500];
    if (item.path === "/api/v1/psychologists/me/credential-file") return [401, 403, 409, 422, 500];
    if (item.path === "/api/v1/psychologists/me/submit-for-review") return [401, 403, 409, 422, 500];
    if (item.path === "/api/v1/psychologists/me/credential-file/:fileId/review-url") return [401, 403, 404, 500];
    if (item.path.includes("/bundles")) return [401, 403, 404, 409, 422, 500];
  }

  if (item.path.startsWith("/api/v1/bookings")) return [401, 403, 404, 409, 422, 500];
  if (item.path.startsWith("/api/v1/payments/")) return [400, 404, 409, 422, 502, 503, 500];
  if (item.path.startsWith("/api/v1/routine/")) {
    if (item.path === "/api/v1/routine/statistics" || item.path === "/api/v1/routine/statistics/activity-summary" || item.path === "/api/v1/routine/relapses" || item.path === "/api/v1/routine/relapses/statistics") return [401, 500];
    return [401, 409, 422, 500];
  }
  if (item.path.startsWith("/api/v1/journals") || item.path.startsWith("/api/v1/community/")) return [401, 403, 404, 409, 422, 500];
  if (item.path === "/api/v1/community") return [401, 403, 422, 500];
  if (item.path.startsWith("/api/v1/education") || item.path.startsWith("/api/v1/content/") || item.path.startsWith("/api/v1/achievements/")) return [401, 404, 500];
  if (item.path.startsWith("/api/v1/ai/")) return [401, 422, 429, 502, 503, 500];

  return [400, 422, 500];
}

function getErrorExample(item: RouteInventoryItem, status: ErrorStatus): ErrorExample {
  const path = item.path;

  if (path === "/validation-demo") {
    if (status === 400) return { code: "BAD_REQUEST", message: "Request body is malformed.", details: ["Request body must be valid JSON."] };
    if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["email: Email must be valid."] };
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to validate demo payload."] };
  }

  if (path === "/api/v1/auth/register" || path === "/api/v1/auth/register/psychologist") {
    if (status === 400) return { code: "BAD_REQUEST", message: "Request body is malformed.", details: ["Request body must be valid JSON."] };
    if (status === 409) return { code: "CONFLICT", message: "Email already registered.", details: ["email: Email is already registered."] };
    if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["email: Email must be valid.", "password: Password must be at least 8 characters."] };
    if (status === 429) return { code: "RATE_LIMITED", message: "Too many registration attempts.", details: ["Too many registration attempts. Please retry later."] };
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to create auth account."] };
  }

  if (path === "/api/v1/auth/login") {
    if (status === 400) return { code: "BAD_REQUEST", message: "Request body is malformed.", details: ["Request body must be valid JSON."] };
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Invalid credentials.", details: ["Invalid identifier or password."] };
    if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["identifier: Identifier is required.", "password: Password is required."] };
    if (status === 429) return { code: "RATE_LIMITED", message: "Too many login attempts.", details: ["Too many login attempts. Please retry later."] };
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to verify credentials."] };
  }

  if (path === "/api/v1/auth/logout" || path === "/api/v1/auth/me" || path === "/api/v1/auth/onboarding" || path === "/api/v1/users/me" || path === "/api/v1/users/settings") {
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Authentication required.", details: ["Bearer token is missing or invalid."] };
    if (status === 404) return { code: "NOT_FOUND", message: "Profile not found.", details: ["Current user profile was not found."] };
    if (status === 422) {
      if (path === "/api/v1/auth/onboarding" || path === "/api/v1/users/settings") return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["recoveryGoal: Must not be empty.", "checkInTime: Must use HH:mm format."] };
      return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["Request body must be valid JSON."] };
    }
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to load current user profile."] };
  }

  if (path.startsWith("/api/v1/psychologists/")) {
    if (path === "/api/v1/psychologists") {
      if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to load psychologist directory."] };
    }
    if (path === "/api/v1/psychologists/:psychologistId" || path === "/api/v1/psychologists/:psychologistId/sessions") {
      if (status === 404) return { code: "NOT_FOUND", message: "Psychologist not found.", details: ["Approved psychologist was not found."] };
      if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["psychologistId: Must be a valid psychologist id."] };
      if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to load public psychologist data."] };
    }
    if (path === "/api/v1/psychologists/register" || path === "/api/v1/psychologists/me") {
      if (status === 403) return { code: "FORBIDDEN", message: "Access denied.", details: ["Only psychologists can manage this profile."] };
      if (status === 409) return { code: "CONFLICT", message: "Psychologist profile conflicts with current state.", details: ["Psychologist profile already exists for this account."] };
      if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["type: Must be one of general, clinical.", "fullName: Must be a non-empty string."] };
      if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to save psychologist profile."] };
    }
    if (path === "/api/v1/psychologists/me/credential-file") {
      if (status === 409) return { code: "CONFLICT", message: "Psychologist profile not ready.", details: ["Psychologist profile must be completed before uploading credentials."] };
      if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["file: Credential file is required.", "documentType: Must be a supported credential document type."] };
      if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to upload credential file."] };
    }
    if (path === "/api/v1/psychologists/me/submit-for-review") {
      if (status === 409) return { code: "CONFLICT", message: "Profile is not ready for review.", details: ["Required profile fields or credential files are missing."] };
      if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to submit psychologist profile for review."] };
    }
    if (path === "/api/v1/psychologists/me/credential-file/:fileId/review-url") {
      if (status === 404) return { code: "NOT_FOUND", message: "Credential file not found.", details: ["Credential file was not found."] };
      if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to create credential review URL."] };
    }
    if (path.includes("/bundles")) {
      if (status === 404) return { code: "NOT_FOUND", message: "Bundle not found.", details: ["Psychologist bundle was not found."] };
      if (status === 409) return { code: "CONFLICT", message: "Bundle conflicts with current schedule.", details: ["Bundle overlaps with existing session dates or times."] };
      if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["dateStart: Must use YYYY-MM-DD format.", "priceAmount: Must be between 100000 and 300000."] };
      if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to save session bundle."] };
    }
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Authentication required.", details: ["Bearer token is missing or invalid."] };
  }

  if (path.startsWith("/api/v1/bookings")) {
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Authentication required.", details: ["Bearer token is missing or invalid."] };
    if (status === 403) return { code: "FORBIDDEN", message: "Access denied.", details: ["You can only access your own booking."] };
    if (status === 404) return { code: "NOT_FOUND", message: "Booking not found.", details: ["Booking was not found."] };
    if (status === 409) {
      if (path === "/api/v1/bookings") return { code: "CONFLICT", message: "Session slot already booked.", details: ["Selected session slot is already booked."] };
      if (path.endsWith("/confirm")) return { code: "CONFLICT", message: "Booking cannot be confirmed.", details: ["Booking must be paid before confirmation."] };
      return { code: "CONFLICT", message: "Booking conflicts with current state.", details: ["Booking state cannot be changed."] };
    }
    if (status === 422) {
      if (path.endsWith("/confirm")) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["meetLink: Must be a string or null."] };
      if (path.endsWith("/reschedule")) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["newSessionSlotId: Must be a valid session slot id.", "reason: Reason is required."] };
      return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["sessionSlotId: Must be a valid session slot id."] };
    }
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to process booking request."] };
  }

  if (path.startsWith("/api/v1/payments/")) {
    if (status === 400) return { code: "BAD_REQUEST", message: "Webhook body is malformed.", details: ["Request body must be valid JSON."] };
    if (status === 404) return { code: "NOT_FOUND", message: "Booking not found.", details: ["Webhook order_id does not match any booking."] };
    if (status === 409) return { code: "CONFLICT", message: "Payment amount mismatch.", details: ["amount: Webhook amount does not match booking amount."] };
    if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["project: Project is required.", "order_id: Order id is required."] };
    if (status === 502) return { code: "DOWNSTREAM_ERROR", message: "Payment provider detail lookup failed.", details: ["Failed to verify Pakasir transaction detail."] };
    if (status === 503) return { code: "SERVICE_UNAVAILABLE", message: "Payment provider is temporarily unavailable.", details: ["Pakasir webhook verification is temporarily unavailable."] };
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to process payment webhook."] };
  }

  if (path.startsWith("/api/v1/routine/")) {
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Authentication required.", details: ["Bearer token is missing or invalid."] };
    if (status === 409) return { code: "CONFLICT", message: "Duplicate daily entry.", details: ["A check-in or relapse already exists for this local date."] };
    if (status === 422) {
      if (path.endsWith("/relapses")) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["mood: Mood must be an integer from 1 to 5.", "triggers: At least one trigger is required."] };
      return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["mood: Mood must be an integer from 1 to 5."] };
    }
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to save routine entry."] };
  }

  if (path.startsWith("/api/v1/journals") || path.startsWith("/api/v1/community")) {
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Authentication required.", details: ["Bearer token is missing or invalid."] };
    if (status === 403) return { code: "FORBIDDEN", message: "Access denied.", details: ["You can only manage your own content."] };
    if (status === 404) return { code: "NOT_FOUND", message: "Content not found.", details: ["Post, comment, or journal was not found."] };
    if (status === 409) return { code: "CONFLICT", message: "Content conflicts with current state.", details: ["Resource already exists or state cannot be changed."] };
    if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["content: Must not be empty."] };
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to process content request."] };
  }

  if (path.startsWith("/api/v1/education") || path.startsWith("/api/v1/content/") || path.startsWith("/api/v1/achievements/")) {
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Authentication required.", details: ["Bearer token is missing or invalid."] };
    if (status === 404) return { code: "NOT_FOUND", message: "Resource not found.", details: ["Requested catalog item was not found."] };
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to load catalog data."] };
  }

  if (path.startsWith("/api/v1/ai/")) {
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Authentication required.", details: ["Bearer token is missing or invalid."] };
    if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["message: Must not be empty."] };
    if (status === 429) return { code: "RATE_LIMITED", message: "AI provider rate limit reached.", details: ["Too many AI requests. Please retry later."] };
    if (status === 502) return { code: "DOWNSTREAM_ERROR", message: "AI provider request failed.", details: ["Failed to reach SumoPod AI provider."] };
    if (status === 503) return { code: "SERVICE_UNAVAILABLE", message: "AI provider is temporarily unavailable.", details: ["AI provider is temporarily unavailable."] };
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to process AI request."] };
  }

  const fallback: Record<ErrorStatus, ErrorExample> = {
    400: { code: "BAD_REQUEST", message: "Request body is malformed.", details: ["Request body must be valid JSON."] },
    401: { code: "UNAUTHENTICATED", message: "Authentication required.", details: ["Bearer token is missing or invalid."] },
    403: { code: "FORBIDDEN", message: "Access denied.", details: ["You are not allowed to access this resource."] },
    404: { code: "NOT_FOUND", message: "Resource not found.", details: ["Resource was not found."] },
    409: { code: "CONFLICT", message: "Request conflicts with current state.", details: ["Resource state conflicts with this request."] },
    422: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["field: Must be valid."] },
    429: { code: "RATE_LIMITED", message: "Too many requests.", details: ["Too many requests. Please retry later."] },
    500: { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["An unexpected error occurred."] },
    502: { code: "DOWNSTREAM_ERROR", message: "Downstream service failed.", details: ["Failed to reach downstream provider."] },
    503: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable.", details: ["Service is temporarily unavailable."] },
  };

  return fallback[status];
}

function responses(item: RouteInventoryItem, contract: OperationContract) {
  const successStatus = contract.successStatus ?? (item.method === "POST" && !item.path.includes("confirm") && !item.path.includes("reschedule") && !item.path.includes("webhook") && item.path !== "/api/v1/auth/login" && item.path !== "/api/v1/auth/logout" ? "201" : "200");
  const successExample = { success: true, message: contract.successMessage ?? "Request processed successfully", data: contract.successExample ?? null, meta: contract.paginated ? { pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false } } : null };
  const errorResponses = Object.fromEntries(getErrorStatusList(item).map((status) => [status, errorResponse(status, getErrorExample(item, status))]));

  return {
    [successStatus]: { description: "Success response", content: { [json]: { schema: successEnvelopeSchema(contract.successSchema, contract.paginated), examples: { success: { summary: `${successStatus} success`, value: successExample } } } } },
    ...errorResponses,
  };
}
function buildOperation(item: RouteInventoryItem) {
  const key = operationKey(item.method, item.path);
  const contract = contracts[key] ?? { summary: `${item.method} ${item.path}`, description: moduleDoc("Endpoint contract is generated from route inventory."), successSchema: { type: "object", additionalProperties: true }, successExample: { id: "resource_123" } };
  const operation: Record<string, unknown> = { tags: [getTag(item.path)], summary: contract.summary, description: contract.description, operationId: toOperationId(item.method, item.path), responses: responses(item, contract), "x-codeSamples": [{ lang: "Shell", label: "cURL", source: `curl -X ${item.method} ${defaultApiServerUrl}${toOpenApiPath(item.path)}` }] };
  const params = pathParameters(item.path);
  if (params.length) operation.parameters = params;
  if (item.auth === "bearer") operation.security = [{ bearerAuth: [] }];
  if (contract.requestBody) operation.requestBody = { required: true, content: { [contract.requestBody.contentType ?? json]: { schema: contract.requestBody.schema, examples: Object.fromEntries(Object.entries(contract.requestBody.examples).map(([name, value]) => [name, { summary: name, value }])) } } };
  return operation;
}

const basePaths = routeInventory.reduce<Record<string, Record<string, unknown>>>((paths, item) => {
  const path = toOpenApiPath(item.path);
  paths[path] = paths[path] ?? {};
  paths[path][item.method.toLowerCase()] = buildOperation(item);
  return paths;
}, {});

export const pulihOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "Pulih API",
    version: "0.1.0",
    summary: "Recovery support, psychologist booking, payments, content, achievements, and safe AI coach API.",
    description: "Complete OpenAPI reference for Pulih MVP. Includes module-level docs, request payload schemas, response envelopes, examples for success and common error status codes, auth requirements, route inventory parity, and mental-health safety notes.",
  },
  servers: [{ url: defaultApiServerUrl, description: "Local development server" }],
  tags: [
    { name: "platform", description: "Health probes, validation demo, OpenAPI artifacts, and Scalar docs." },
    { name: "auth", description: "Email/password registration, login, logout, current principal, and onboarding." },
    { name: "users", description: "Current user profile and recovery settings." },
    { name: "psychologists", description: "Psychologist onboarding, credentials, review submission, bundles, public directory, and sessions." },
    { name: "bookings", description: "Patient booking lifecycle, payment hold, confirmation, channel access, and reschedule." },
    { name: "payments", description: "Pakasir webhook processing and payment status transitions." },
    { name: "routine", description: "Daily check-ins, relapse tracking, streaks, and recovery statistics." },
    { name: "journals", description: "Private owner-only journal entries." },
    { name: "community", description: "Authenticated community posts, comments, and likes." },
    { name: "education", description: "Recovery education catalog." },
    { name: "content", description: "Daily motivation and challenge content." },
    { name: "achievements", description: "Achievement catalog, progress, and unlocked achievements." },
    { name: "ai", description: "Non-streaming safe AI coach, relapse help, summaries, and persona preferences." },
  ],
  paths: basePaths,
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Paste access token from login/register response. Header: Authorization: Bearer <token>." } },
    schemas,
    responses: {
      BadRequestError: errorResponse(400, { code: "BAD_REQUEST", details: ["Request body must be valid JSON."], message: "Request body is malformed." }),
      ValidationError: errorResponse(422, { code: "VALIDATION_ERROR", details: ["email: Email must be valid."], message: "Request validation failed." }),
      UnauthorizedError: errorResponse(401, { code: "UNAUTHENTICATED", details: ["Bearer token is missing or invalid."], message: "Authentication required." }),
      ForbiddenError: errorResponse(403, { code: "FORBIDDEN", details: ["You are not allowed to access this resource."], message: "Access denied." }),
      NotFoundError: errorResponse(404, { code: "NOT_FOUND", details: ["Resource was not found."], message: "Resource not found." }),
      ConflictError: errorResponse(409, { code: "CONFLICT", details: ["Resource state conflicts with this request."], message: "Request conflicts with current state." }),
      InternalError: errorResponse(500, { code: "INTERNAL_ERROR", details: ["An unexpected error occurred."], message: "Unexpected internal error." }),
    },
  },
} as const;

export function getOpenApiJson(options: { serverUrl?: string } = {}) {
  const serverUrl = (options.serverUrl?.trim() || defaultApiServerUrl).replace(/\/+$/, "");
  if (serverUrl === defaultApiServerUrl) return pulihOpenApi;

  const document = structuredClone(pulihOpenApi) as typeof pulihOpenApi;
  (document as unknown as { servers: { url: string; description: string }[] }).servers = [{ url: serverUrl, description: "Configured API server" }];

  for (const methods of Object.values(document.paths) as Record<string, Record<string, unknown>>[]) {
    for (const operation of Object.values(methods) as Record<string, unknown>[]) {
      const codeSamples = operation["x-codeSamples"] as { source?: string }[] | undefined;
      codeSamples?.forEach((sample) => {
        if (sample.source) sample.source = sample.source.replace(defaultApiServerUrl, serverUrl);
      });
    }
  }

  return document;
}
export function getOpenApiPaths() {
  return Object.keys(pulihOpenApi.paths);
}
