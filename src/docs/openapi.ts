import { routeInventory, type RouteInventoryItem } from "../routes/api-route-inventory";

const apiServerUrl = "http://localhost:3000";
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
    properties: { id: uuid(examples.userId), email: { type: "string", format: "email", example: "patient@example.com" }, role: { type: "string", enum: ["patient", "psychologist", "admin"], example: "patient" }, status: { type: "string", example: "active" } },
  },
  AuthTokenResponse: {
    type: "object",
    required: ["accessToken", "tokenType", "expiresIn", "user"],
    properties: { accessToken: { type: "string", description: "JWT access token. Store client-side only; never log.", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo" }, tokenType: { type: "string", enum: ["Bearer"], example: "Bearer" }, expiresIn: { type: "integer", example: 86400 }, user: ref("AuthUser") },
  },
  UserProfile: {
    type: "object",
    required: ["userId", "email", "role", "status", "displayName", "nickname", "recoveryGoal", "checkInTime", "onboardingCompletedAt"],
    properties: { userId: uuid(examples.userId), email: { type: "string", format: "email", example: "patient@example.com" }, role: { type: "string", enum: ["patient", "psychologist", "admin"], example: "patient" }, status: { type: "string", example: "active" }, displayName: nullableString("Pulih Demo", { maxLength: 255 }), nickname: nullableString("Demo", { maxLength: 255 }), recoveryGoal: nullableString("Build a daily recovery streak", { maxLength: 2000 }), checkInTime: nullableString("07:30:00", { pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$" }), onboardingCompletedAt: nullableString("2026-07-16T16:00:00.000Z", { format: "date-time" }) },
  },
  PracticePlace: {
    type: "object",
    required: ["name", "address", "isActive"],
    properties: { name: { type: "string", maxLength: 255, example: "Pulih Clinic" }, address: { type: "string", maxLength: 1000, example: "Jl. Demo No. 1" }, isActive: { type: "boolean", example: true } },
  },
  PsychologistProfile: {
    type: "object",
    required: ["id", "userId", "type", "fullName", "status", "licenseNumber", "bio", "practicePlaces", "createdAt", "updatedAt"],
    properties: { id: uuid(examples.psychologistId), userId: uuid(examples.userId), type: { type: "string", enum: ["general", "clinical"], example: "clinical" }, fullName: { type: "string", example: "Dr. Demo" }, status: { type: "string", enum: ["draft", "in_review", "approved", "rejected"], example: "draft" }, licenseNumber: nullableString("STR-123456"), bio: nullableString("Licensed clinical psychologist."), practicePlaces: arr(ref("PracticePlace")), createdAt: dateTime("2026-07-16T10:00:00.000Z"), updatedAt: dateTime("2026-07-16T10:00:00.000Z") },
  },
  CredentialFile: {
    type: "object",
    required: ["id", "documentType", "fileName", "contentType", "sizeBytes", "createdAt"],
    properties: { id: uuid(examples.fileId), documentType: { type: "string", enum: ["sipp", "ijazah", "str", "strpk", "sippk"], example: "str" }, fileName: { type: "string", example: "credential-str.pdf" }, contentType: { type: "string", enum: ["application/pdf", "image/jpeg", "image/png"], example: "application/pdf" }, sizeBytes: { type: "integer", maximum: 5242880, example: 248000 }, createdAt: dateTime("2026-07-16T10:00:00.000Z") },
  },
  CredentialReviewUrl: {
    type: "object",
    required: ["fileId", "reviewUrl", "expiresAt"],
    properties: { fileId: uuid(examples.fileId), reviewUrl: { type: ["string", "null"], format: "uri", example: "https://example-r2-signed-url.local/credential.pdf" }, expiresAt: nullableString("2026-07-16T10:15:00.000Z", { format: "date-time" }) },
  },
  SessionBundle: {
    type: "object",
    required: ["id", "psychologistId", "name", "dateStart", "dateEnd", "dailyStartTime", "dailyEndTime", "priceAmount", "generatedSessionCount"],
    properties: { id: uuid(examples.bundleId), psychologistId: uuid(examples.psychologistId), name: { type: "string", example: "Clinical session bundle 2026-06-01 to 2026-06-07" }, dateStart: date("2026-06-01"), dateEnd: date("2026-06-07"), dailyStartTime: { type: "string", example: "09:00:00" }, dailyEndTime: { type: "string", example: "12:00:00" }, priceAmount: { type: "integer", minimum: 100000, maximum: 300000, example: 150000 }, generatedSessionCount: { type: "integer", example: 7 } },
  },
  PublicPsychologist: {
    type: "object",
    required: ["id", "type", "fullName", "bio", "practicePlaces"],
    properties: { id: uuid(examples.psychologistId), type: { type: "string", enum: ["general", "clinical"], example: "clinical" }, fullName: { type: "string", example: "Dr. Demo" }, bio: nullableString("Licensed clinical psychologist."), practicePlaces: arr(ref("PracticePlace")) },
  },
  SessionSlot: {
    type: "object",
    required: ["id", "psychologistId", "bundleId", "date", "startTime", "endTime", "priceAmount", "status", "channel"],
    properties: { id: uuid(examples.sessionSlotId), psychologistId: uuid(examples.psychologistId), bundleId: uuid(examples.bundleId), date: date("2026-06-03"), startTime: { type: "string", example: "09:00:00" }, endTime: { type: "string", example: "12:00:00" }, priceAmount: { type: "integer", example: 150000 }, status: { type: "string", enum: ["available", "held", "booked"], example: "available" }, channel: { type: "string", enum: ["chat", "meet"], example: "meet" } },
  },
  Payment: {
    type: "object",
    required: ["id", "provider", "status", "amount", "paymentUrl", "expiresAt"],
    properties: { id: uuid(examples.paymentId), provider: { type: "string", enum: ["pakasir"], example: "pakasir" }, status: { type: "string", enum: ["pending", "paid", "expired", "failed"], example: "pending" }, amount: { type: "integer", example: 150000 }, paymentUrl: { type: "string", format: "uri", example: "https://pakasir.zone.id/pay/pulih-demo/order_123" }, expiresAt: dateTime("2026-07-16T17:00:00.000Z") },
  },
  Booking: {
    type: "object",
    required: ["id", "patientId", "psychologistId", "sessionSlotId", "status", "payment", "sessionChannel", "meetLink", "scheduledAt"],
    properties: { id: uuid(examples.bookingId), patientId: uuid(examples.userId), psychologistId: uuid(examples.psychologistId), sessionSlotId: uuid(examples.sessionSlotId), status: { type: "string", enum: ["pending_payment", "paid", "confirmed", "completed", "rescheduled", "expired"], example: "pending_payment" }, payment: ref("Payment"), sessionChannel: { type: "string", enum: ["chat", "meet"], example: "meet" }, meetLink: nullableString(null, { format: "uri" }), scheduledAt: dateTime("2026-06-03T02:00:00.000Z") },
  },
  CheckIn: {
    type: "object",
    required: ["id", "userId", "mood", "note", "localDate", "createdAt"],
    properties: { id: uuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), userId: uuid(examples.userId), mood: { type: "integer", minimum: 1, maximum: 5, example: 4 }, note: nullableString("Feeling better today."), localDate: date("2026-07-16"), createdAt: dateTime("2026-07-16T01:00:00.000Z") },
  },
  Relapse: {
    type: "object",
    required: ["id", "userId", "mood", "triggers", "note", "localDate", "createdAt"],
    properties: { id: uuid("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), userId: uuid(examples.userId), mood: { type: "integer", minimum: 1, maximum: 5, example: 2 }, triggers: arr({ type: "string", maxLength: 100 }, ["stress", "late-night scrolling"]), note: nullableString("Late-night stress."), localDate: date("2026-07-16"), createdAt: dateTime("2026-07-16T01:00:00.000Z") },
  },
  RoutineStatistics: {
    type: "object",
    required: ["currentStreak", "longestStreak", "checkInCount", "relapseCount", "lastCheckInDate"],
    properties: { currentStreak: { type: "integer", example: 7 }, longestStreak: { type: "integer", example: 14 }, checkInCount: { type: "integer", example: 21 }, relapseCount: { type: "integer", example: 2 }, lastCheckInDate: nullableString("2026-07-16", { format: "date" }) },
  },
  Journal: {
    type: "object",
    required: ["id", "userId", "content", "createdAt", "updatedAt"],
    properties: { id: uuid("cccccccc-cccc-4ccc-8ccc-cccccccccccc"), userId: uuid(examples.userId), content: { type: "string", maxLength: 5000, example: "Today I stayed consistent." }, createdAt: dateTime("2026-07-16T01:00:00.000Z"), updatedAt: dateTime("2026-07-16T01:00:00.000Z") },
  },
  CommunityPost: {
    type: "object",
    required: ["id", "authorId", "category", "content", "likeCount", "commentCount", "createdAt"],
    properties: { id: uuid(examples.postId), authorId: uuid(examples.userId), category: { type: "string", enum: ["general", "support", "progress"], example: "progress" }, content: { type: "string", maxLength: 2000, example: "I kept my routine today." }, likeCount: { type: "integer", example: 3 }, commentCount: { type: "integer", example: 1 }, createdAt: dateTime("2026-07-16T01:00:00.000Z") },
  },
  CommunityComment: {
    type: "object",
    required: ["id", "postId", "authorId", "content", "createdAt"],
    properties: { id: uuid(examples.commentId), postId: uuid(examples.postId), authorId: uuid(examples.userId), content: { type: "string", maxLength: 1000, example: "You are not alone." }, createdAt: dateTime("2026-07-16T01:10:00.000Z") },
  },
  EducationContent: {
    type: "object",
    required: ["id", "title", "summary", "body", "category"],
    properties: { id: { type: "string", example: "edu_001" }, title: { type: "string", example: "Understanding triggers" }, summary: { type: "string", example: "Short guide to noticing recovery triggers." }, body: { type: "string", example: "Triggers are signals, not failures..." }, category: { type: "string", example: "recovery-basics" } },
  },
  DailyContent: {
    type: "object",
    required: ["date", "motivation", "challenge"],
    properties: { date: date("2026-07-16"), motivation: { type: "string", example: "Small steps still count." }, challenge: { type: "string", example: "Write one supportive sentence to yourself." } },
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
  AiCoachResponse: {
    type: "object",
    required: ["message", "safetyNotice", "conversationId"],
    properties: { message: { type: "string", example: "Pause for 90 seconds, breathe slowly, and move away from the trigger." }, safetyNotice: { type: "string", example: "Pulih AI does not replace emergency or professional care." }, conversationId: { type: "string", example: "chat_001" } },
  },
  RelapsePreventionPlan: {
    type: "object",
    required: ["delay", "distract", "decide", "safetyNotice"],
    properties: { delay: arr({ type: "string" }, ["Wait 10 minutes before acting on the urge."]), distract: arr({ type: "string" }, ["Take a short walk."]), decide: arr({ type: "string" }, ["Message a trusted person."]), safetyNotice: { type: "string", example: "Seek local emergency help if you may harm yourself or others." } },
  },
  PaymentWebhookResult: {
    type: "object",
    required: ["orderId", "bookingId", "paymentStatus", "bookingStatus", "processed"],
    properties: { orderId: { type: "string", example: "order_123" }, bookingId: uuid(examples.bookingId), paymentStatus: { type: "string", example: "paid" }, bookingStatus: { type: "string", example: "paid" }, processed: { type: "boolean", example: true } },
  },
  ValidationDemoResult: {
    type: "object",
    required: ["name", "email"],
    properties: { name: { type: "string", example: "Pulih Demo" }, email: { type: "string", format: "email", example: "demo@example.com" } },
  },
} as const;

const schemaExamples: Record<string, Example> = {
  AuthUser: { id: examples.userId, email: "patient@example.com", role: "patient", status: "active" },
  AuthTokenResponse: { accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo", tokenType: "Bearer", expiresIn: 86400, user: { id: examples.userId, email: "patient@example.com", role: "patient", status: "active" } },
  UserProfile: { userId: examples.userId, email: "patient@example.com", role: "patient", status: "active", displayName: "Pulih Demo", nickname: "Demo", recoveryGoal: "Build a daily recovery streak", checkInTime: "07:30:00", onboardingCompletedAt: "2026-07-16T16:00:00.000Z" },
  PsychologistProfile: { id: examples.psychologistId, userId: examples.userId, type: "clinical", fullName: "Dr. Demo", status: "draft", licenseNumber: "STR-123456", bio: "Licensed clinical psychologist.", practicePlaces: [{ name: "Pulih Clinic", address: "Jl. Demo No. 1", isActive: true }], createdAt: "2026-07-16T10:00:00.000Z", updatedAt: "2026-07-16T10:00:00.000Z" },
  CredentialFile: { id: examples.fileId, documentType: "str", fileName: "credential-str.pdf", contentType: "application/pdf", sizeBytes: 248000, createdAt: "2026-07-16T10:00:00.000Z" },
  CredentialReviewUrl: { fileId: examples.fileId, reviewUrl: "https://example-r2-signed-url.local/credential.pdf", expiresAt: "2026-07-16T10:15:00.000Z" },
  SessionBundle: { id: examples.bundleId, psychologistId: examples.psychologistId, name: "Clinical session bundle 2026-06-01 to 2026-06-07", dateStart: "2026-06-01", dateEnd: "2026-06-07", dailyStartTime: "09:00:00", dailyEndTime: "12:00:00", priceAmount: 150000, generatedSessionCount: 7 },
  PublicPsychologist: { id: examples.psychologistId, type: "clinical", fullName: "Dr. Demo", bio: "Licensed clinical psychologist.", practicePlaces: [{ name: "Pulih Clinic", address: "Jl. Demo No. 1", isActive: true }] },
  SessionSlot: { id: examples.sessionSlotId, psychologistId: examples.psychologistId, bundleId: examples.bundleId, date: "2026-06-03", startTime: "09:00:00", endTime: "12:00:00", priceAmount: 150000, status: "available", channel: "meet" },
  Booking: { id: examples.bookingId, patientId: examples.userId, psychologistId: examples.psychologistId, sessionSlotId: examples.sessionSlotId, status: "pending_payment", payment: { id: examples.paymentId, provider: "pakasir", status: "pending", amount: 150000, paymentUrl: "https://pakasir.zone.id/pay/pulih-demo/order_123", expiresAt: "2026-07-16T17:00:00.000Z" }, sessionChannel: "meet", meetLink: null, scheduledAt: "2026-06-03T02:00:00.000Z" },
  CheckIn: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", userId: examples.userId, mood: 4, note: "Feeling better today.", localDate: "2026-07-16", createdAt: "2026-07-16T01:00:00.000Z" },
  Relapse: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", userId: examples.userId, mood: 2, triggers: ["stress", "late-night scrolling"], note: "Late-night stress.", localDate: "2026-07-16", createdAt: "2026-07-16T01:00:00.000Z" },
  RoutineStatistics: { currentStreak: 7, longestStreak: 14, checkInCount: 21, relapseCount: 2, lastCheckInDate: "2026-07-16" },
  Journal: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", userId: examples.userId, content: "Today I stayed consistent.", createdAt: "2026-07-16T01:00:00.000Z", updatedAt: "2026-07-16T01:00:00.000Z" },
  CommunityPost: { id: examples.postId, authorId: examples.userId, category: "progress", content: "I kept my routine today.", likeCount: 3, commentCount: 1, createdAt: "2026-07-16T01:00:00.000Z" },
  CommunityComment: { id: examples.commentId, postId: examples.postId, authorId: examples.userId, content: "You are not alone.", createdAt: "2026-07-16T01:10:00.000Z" },
  EducationContent: { id: "edu_001", title: "Understanding triggers", summary: "Short guide to noticing recovery triggers.", body: "Triggers are signals, not failures...", category: "recovery-basics" },
  DailyContent: { date: "2026-07-16", motivation: "Small steps still count.", challenge: "Write one supportive sentence to yourself." },
  Achievement: { id: "first_checkin", name: "First Check-in", description: "Complete your first daily check-in.", target: 1 },
  AchievementProgress: { achievementId: "first_checkin", progress: 1, target: 1, unlockedAt: "2026-07-16T01:00:00.000Z" },
  AiCoachResponse: { message: "Pause for 90 seconds, breathe slowly, and move away from the trigger.", safetyNotice: "Pulih AI does not replace emergency or professional care.", conversationId: "chat_001" },
  RelapsePreventionPlan: { delay: ["Wait 10 minutes before acting on the urge."], distract: ["Take a short walk."], decide: ["Message a trusted person."], safetyNotice: "Seek local emergency help if you may harm yourself or others." },
  PaymentWebhookResult: { orderId: "order_123", bookingId: examples.bookingId, paymentStatus: "paid", bookingStatus: "paid", processed: true },
  ValidationDemoResult: { name: "Pulih Demo", email: "demo@example.com" },
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
  Register: { type: "object", additionalProperties: false, required: ["email", "password"], properties: { email: { type: "string", format: "email", example: "patient@example.com" }, password: { type: "string", minLength: 1, maxLength: 72, format: "password", example: "password123" } } },
  Onboarding: { type: "object", additionalProperties: false, required: ["recoveryGoal"], properties: { displayName: nullableString("Pulih Demo", { maxLength: 255 }), nickname: nullableString("Demo", { maxLength: 255 }), recoveryGoal: { type: "string", maxLength: 2000, example: "Build a daily recovery streak" }, checkInTime: nullableString("07:30", { pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$" }) } },
  UserSettings: { type: "object", additionalProperties: false, properties: { displayName: nullableString("Pulih Demo", { maxLength: 255 }), nickname: nullableString("Demo", { maxLength: 255 }), recoveryGoal: nullableString("Stay sober for 30 days", { maxLength: 2000 }), checkInTime: nullableString("07:30", { pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$" }) } },
  PsychologistProfile: { type: "object", additionalProperties: false, required: ["type", "fullName"], properties: { type: { type: "string", enum: ["general", "clinical"], example: "clinical" }, fullName: { type: "string", maxLength: 255, example: "Dr. Demo" }, licenseNumber: nullableString("STR-123456", { maxLength: 128 }), bio: nullableString("Licensed clinical psychologist.", { maxLength: 2000 }), practicePlaces: { type: "array", maxItems: 3, items: ref("PracticePlace") } } },
  CredentialUpload: { type: "object", required: ["file", "documentType"], properties: { file: { type: "string", format: "binary", description: "PDF/JPG/JPEG/PNG credential file, max 5 MB." }, documentType: { type: "string", enum: ["sipp", "ijazah", "str", "strpk", "sippk"], example: "str" } } },
  SessionBundle: { type: "object", additionalProperties: false, required: ["dateStart", "dateEnd", "dailyStartTime", "dailyEndTime", "priceAmount"], properties: { dateStart: date("2026-06-01"), dateEnd: date("2026-06-07"), dailyStartTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$", example: "09:00" }, dailyEndTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$", example: "12:00" }, priceAmount: { type: "number", minimum: 100000, maximum: 300000, example: 150000 } } },
  BookingCreate: { type: "object", additionalProperties: false, required: ["sessionSlotId"], properties: { sessionSlotId: uuid(examples.sessionSlotId) } },
  BookingConfirm: { type: "object", additionalProperties: false, properties: { meetLink: nullableString("https://meet.google.com/abc-defg-hij", { format: "uri", description: "Required only for clinical psychologist meet sessions." }) } },
  BookingReschedule: { type: "object", additionalProperties: false, required: ["newSessionSlotId", "reason"], properties: { newSessionSlotId: uuid("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"), reason: { type: "string", maxLength: 2000, example: "Doctor requested a new time" } } },
  PakasirWebhook: { type: "object", additionalProperties: false, required: ["project", "order_id", "amount", "status"], properties: { project: { type: "string", example: "pulih-demo" }, order_id: { type: "string", example: "order_123" }, amount: { type: "number", minimum: 1, example: 150000 }, status: { type: "string", example: "completed" }, payment_method: nullableString("bank_transfer"), completed_at: nullableString("2026-07-16T16:00:00.000Z", { format: "date-time" }) } },
  CheckIn: { type: "object", additionalProperties: false, required: ["mood"], properties: { mood: { type: "integer", minimum: 1, maximum: 5, example: 4 }, note: nullableString("Feeling better today.", { maxLength: 2000 }), localDate: nullableString("2026-07-16", { format: "date" }) } },
  Relapse: { type: "object", additionalProperties: false, required: ["mood", "triggers"], properties: { mood: { type: "integer", minimum: 1, maximum: 5, example: 2 }, triggers: { type: "array", minItems: 1, items: { type: "string", maxLength: 100 }, example: ["stress", "late-night scrolling"] }, note: nullableString("Late-night stress.", { maxLength: 2000 }), localDate: nullableString("2026-07-16", { format: "date" }) } },
  Journal: { type: "object", additionalProperties: false, required: ["content"], properties: { content: { type: "string", minLength: 1, maxLength: 5000, example: "Today I stayed consistent." } } },
  CommunityPost: { type: "object", additionalProperties: false, required: ["category", "content"], properties: { category: { type: "string", enum: ["general", "support", "progress"], example: "progress" }, content: { type: "string", minLength: 1, maxLength: 2000, example: "I kept my routine today." } } },
  CommunityComment: { type: "object", additionalProperties: false, required: ["content"], properties: { content: { type: "string", minLength: 1, maxLength: 1000, example: "You are not alone." } } },
  AskCoach: { type: "object", additionalProperties: false, required: ["message"], properties: { message: { type: "string", minLength: 1, maxLength: 2000, example: "I feel triggered after work." } } },
  RelapseSolution: { type: "object", additionalProperties: false, required: ["situation"], properties: { situation: { type: "string", minLength: 1, maxLength: 2000, example: "Late-night urge after stress." }, triggers: { type: "array", maxItems: 10, items: { type: "string", maxLength: 120 }, example: ["stress"] } } },
  RelapsePreventionPlan: { type: "object", additionalProperties: false, required: ["urgeLevel"], properties: { urgeLevel: { type: "integer", minimum: 1, maximum: 5, example: 4 }, triggers: { type: "array", maxItems: 10, items: { type: "string", maxLength: 120 }, example: ["stress"] }, currentContext: nullableString("At home at night.", { maxLength: 1000 }) } },
  OnboardingAnalysis: { type: "object", additionalProperties: false, properties: { recoveryGoal: nullableString("Build a daily recovery streak.", { maxLength: 500 }), concerns: { type: "array", maxItems: 10, items: { type: "string", maxLength: 120 }, example: ["stress"] }, preferredSupport: nullableString("Gentle reminders.", { maxLength: 500 }) } },
  PersonaPreferences: { type: "object", additionalProperties: false, required: ["tone", "focusAreas"], properties: { tone: { type: "string", enum: ["gentle", "direct", "balanced"], example: "gentle" }, focusAreas: { type: "array", maxItems: 8, items: { type: "string", maxLength: 120 }, example: ["daily check-in", "relapse prevention"] } } },
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
  "POST /api/v1/auth/register": { summary: "Register patient account", description: moduleDoc("Creates a patient account with email/password and returns an access token. Duplicate email returns 409."), requestBody: body(requestSchemas.Register, { patient: { email: "patient@example.com", password: "password123" } }), successStatus: "201", successMessage: "Registration successful", successSchema: ref("AuthTokenResponse"), successExample: schemaExamples.AuthTokenResponse },
  "POST /api/v1/auth/login": { summary: "Login with email and password", description: moduleDoc("Authenticates user credentials and returns a Bearer access token. Invalid credentials return 401."), requestBody: body(requestSchemas.Register, { patient: { email: "patient@example.com", password: "password123" } }), successMessage: "Login successful", successSchema: ref("AuthTokenResponse"), successExample: schemaExamples.AuthTokenResponse },
  "POST /api/v1/auth/logout": { summary: "Logout current client", description: moduleDoc("Access-token-only MVP logout. Client discards token; server returns null data."), successMessage: "Logout successful", successSchema: { type: "null" }, successExample: null },
  "GET /api/v1/auth/me": { summary: "Read authenticated user", description: moduleDoc("Returns authenticated principal from Bearer token."), successMessage: "Authenticated user retrieved successfully", ...successData("AuthUser") },
  "POST /api/v1/auth/onboarding": { summary: "Complete onboarding", description: moduleDoc("Stores recovery onboarding data for current user. Product date/time semantics follow Asia/Jakarta."), requestBody: body(requestSchemas.Onboarding, { complete: { displayName: "Pulih Demo", nickname: "Demo", recoveryGoal: "Build a daily recovery streak", checkInTime: "07:30" } }), successMessage: "Onboarding completed successfully", ...successData("UserProfile") },
  "GET /api/v1/users/me": { summary: "Read current user profile", description: moduleDoc("Returns current user's profile and onboarding fields."), successMessage: "Current user retrieved successfully", ...successData("UserProfile") },
  "PUT /api/v1/users/settings": { summary: "Update current user settings", description: moduleDoc("Updates editable current-user settings. Unknown fields return 422."), requestBody: body(requestSchemas.UserSettings, { profile: { displayName: "Pulih Demo", nickname: "Demo", recoveryGoal: "Stay sober for 30 days", checkInTime: "07:30" } }), successMessage: "Settings updated successfully", ...successData("UserProfile") },
  "POST /api/v1/psychologists/register": { summary: "Create or update psychologist profile", description: moduleDoc("Creates psychologist profile shell. General psychologists cannot submit practice places. Clinical psychologists can submit max 3 practice places."), requestBody: body(requestSchemas.PsychologistProfile, { clinical: { type: "clinical", fullName: "Dr. Demo", licenseNumber: "STR-123456", bio: "Licensed clinical psychologist.", practicePlaces: [{ name: "Pulih Clinic", address: "Jl. Demo No. 1", isActive: true }] }, general: { type: "general", fullName: "Konselor Demo", licenseNumber: "SIPP-123456", bio: "General counseling support." } }), successStatus: "201", successMessage: "Psychologist profile saved successfully", ...successData("PsychologistProfile") },
  "GET /api/v1/psychologists/me": { summary: "Read psychologist profile", description: moduleDoc("Returns current authenticated psychologist profile, including draft/review status."), successMessage: "Request processed successfully", ...successData("PsychologistProfile") },
  "PUT /api/v1/psychologists/me": { summary: "Update psychologist profile", description: moduleDoc("Updates current psychologist profile before or during review."), requestBody: body(requestSchemas.PsychologistProfile, { clinical: { type: "clinical", fullName: "Dr. Demo", licenseNumber: "STR-123456", bio: "Updated bio.", practicePlaces: [{ name: "Pulih Clinic", address: "Jl. Demo No. 1", isActive: true }] } }), successMessage: "Psychologist profile updated successfully", ...successData("PsychologistProfile") },
  "POST /api/v1/psychologists/me/credential-file": { summary: "Upload psychologist credential file", description: moduleDoc("Uploads private credential file. Allowed: PDF/JPG/JPEG/PNG, max 5 MB. Required docs differ by psychologist type."), requestBody: body(requestSchemas.CredentialUpload, { clinical_str: { documentType: "str", file: "credential-str.pdf" } }, "multipart/form-data"), successStatus: "201", successMessage: "Credential file uploaded successfully", ...successData("CredentialFile") },
  "POST /api/v1/psychologists/me/submit-for-review": { summary: "Submit psychologist profile for review", description: moduleDoc("Validates required profile fields and credential file metadata, then moves profile to in_review for manual ops approval."), successMessage: "Psychologist profile submitted for review", ...successData("PsychologistProfile") },
  "GET /api/v1/psychologists/me/credential-file/:fileId/review-url": { summary: "Create credential review URL", description: moduleDoc("Returns short-lived private review URL or fallback metadata for authenticated owner."), successMessage: "Request processed successfully", ...successData("CredentialReviewUrl") },
  "POST /api/v1/psychologists/me/bundles": { summary: "Create session bundle", description: moduleDoc("Creates bundle using local dates/times and generates session slots. Price must be Rp100.000–Rp300.000."), requestBody: body(requestSchemas.SessionBundle, { weekly: { dateStart: "2026-06-01", dateEnd: "2026-06-07", dailyStartTime: "09:00", dailyEndTime: "12:00", priceAmount: 150000 } }), successStatus: "201", successMessage: "Session bundle created successfully", ...successData("SessionBundle") },
  "PUT /api/v1/psychologists/me/bundles/:bundleId": { summary: "Update session bundle", description: moduleDoc("Updates owned bundle and regenerated session availability according to service rules."), requestBody: body(requestSchemas.SessionBundle, { weekly: { dateStart: "2026-06-01", dateEnd: "2026-06-07", dailyStartTime: "10:00", dailyEndTime: "12:00", priceAmount: 175000 } }), successMessage: "Session bundle updated successfully", ...successData("SessionBundle") },
  "DELETE /api/v1/psychologists/me/bundles/:bundleId": { summary: "Delete session bundle", description: moduleDoc("Deletes owned bundle when allowed. Booked slots return conflict."), successMessage: "Session bundle deleted successfully", successSchema: { type: "object", required: ["deleted"], properties: { deleted: { type: "boolean", example: true }, bundleId: uuid(examples.bundleId) } }, successExample: { deleted: true, bundleId: examples.bundleId } },
  "GET /api/v1/psychologists": { summary: "List approved psychologists", description: moduleDoc("Returns public directory of manually approved psychologists."), successMessage: "Request processed successfully", ...successArray("PublicPsychologist") },
  "GET /api/v1/psychologists/:psychologistId": { summary: "Read approved psychologist detail", description: moduleDoc("Returns public profile for approved psychologist. Draft/rejected profiles are hidden."), successMessage: "Request processed successfully", ...successData("PublicPsychologist") },
  "GET /api/v1/psychologists/:psychologistId/sessions": { summary: "List generated sessions", description: moduleDoc("Returns public available session slots generated from psychologist bundles."), successMessage: "Request processed successfully", ...successArray("SessionSlot") },
  "POST /api/v1/bookings": { summary: "Create booking", description: moduleDoc("Creates pending-payment booking, claims session slot, creates Pakasir payment URL, and sets 1-hour expiry."), requestBody: body(requestSchemas.BookingCreate, { slot: { sessionSlotId: examples.sessionSlotId } }), successStatus: "201", successMessage: "Booking created successfully", ...successData("Booking") },
  "GET /api/v1/bookings": { summary: "List my bookings", description: moduleDoc("Lists bookings visible to current patient or psychologist."), successMessage: "Bookings retrieved successfully", ...successArray("Booking") },
  "GET /api/v1/bookings/:bookingId": { summary: "Read booking detail", description: moduleDoc("Returns booking detail if current user is patient owner or assigned psychologist."), successMessage: "Booking retrieved successfully", ...successData("Booking") },
  "POST /api/v1/bookings/:bookingId/confirm": { summary: "Confirm paid booking", description: moduleDoc("Psychologist confirms paid booking. Clinical sessions require meet link; general sessions remain chat-only."), requestBody: body(requestSchemas.BookingConfirm, { clinical: { meetLink: "https://meet.google.com/abc-defg-hij" }, general: { meetLink: null } }), successMessage: "Booking confirmed successfully", ...successData("Booking") },
  "POST /api/v1/bookings/:bookingId/reschedule": { summary: "Reschedule booking", description: moduleDoc("Psychologist moves booking to new generated slot with reason. MVP applies immediately without patient approval."), requestBody: body(requestSchemas.BookingReschedule, { new_slot: { newSessionSlotId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", reason: "Doctor requested a new time" } }), successMessage: "Booking rescheduled successfully", ...successData("Booking") },
  "POST /api/v1/payments/pakasir/webhook": { summary: "Process Pakasir webhook", description: moduleDoc("Validates webhook body, verifies order/project/amount through service logic, and idempotently updates payment + booking status."), requestBody: body(requestSchemas.PakasirWebhook, { completed: { project: "pulih-demo", order_id: "order_123", amount: 150000, status: "completed", payment_method: "bank_transfer", completed_at: "2026-07-16T16:00:00.000Z" } }), successMessage: "Payment webhook processed successfully", ...successData("PaymentWebhookResult") },
  "POST /api/v1/routine/checkin": { summary: "Create routine check-in", description: moduleDoc("Stores one daily check-in using Asia/Jakarta local date semantics."), requestBody: body(requestSchemas.CheckIn, { today: { mood: 4, note: "Feeling better today.", localDate: "2026-07-16" } }), successStatus: "201", successMessage: "Check-in saved successfully", ...successData("CheckIn") },
  "POST /api/v1/routine/relapses": { summary: "Create relapse event", description: moduleDoc("Records relapse event with mood, triggers, optional note, and local date."), requestBody: body(requestSchemas.Relapse, { event: { mood: 2, triggers: ["stress", "late-night scrolling"], note: "Late-night stress.", localDate: "2026-07-16" } }), successStatus: "201", successMessage: "Relapse recorded successfully", ...successData("Relapse") },
  "GET /api/v1/routine/statistics": { summary: "Read routine statistics", description: moduleDoc("Returns streak, check-in, and relapse summary for current user."), successMessage: "Routine statistics retrieved successfully", ...successData("RoutineStatistics") },
  "GET /api/v1/routine/statistics/activity-summary": { summary: "Read routine activity summary", description: moduleDoc("Returns compact recent activity buckets for dashboard display."), successMessage: "Routine activity summary retrieved successfully", successSchema: { type: "object", required: ["days"], properties: { days: { type: "array", items: { type: "object", required: ["date", "checkedIn", "relapseCount"], properties: { date: date("2026-07-16"), checkedIn: { type: "boolean", example: true }, relapseCount: { type: "integer", example: 0 } } } } } }, successExample: { days: [{ date: "2026-07-16", checkedIn: true, relapseCount: 0 }] } },
  "GET /api/v1/routine/relapses": { summary: "List relapse events", description: moduleDoc("Returns current user's relapse history."), successMessage: "Relapses retrieved successfully", ...successArray("Relapse") },
  "GET /api/v1/routine/relapses/statistics": { summary: "Read relapse statistics", description: moduleDoc("Returns relapse count and top trigger summary."), successMessage: "Relapse statistics retrieved successfully", successSchema: { type: "object", required: ["total", "topTriggers"], properties: { total: { type: "integer", example: 2 }, topTriggers: { type: "array", items: { type: "object", required: ["trigger", "count"], properties: { trigger: { type: "string", example: "stress" }, count: { type: "integer", example: 2 } } } } } }, successExample: { total: 2, topTriggers: [{ trigger: "stress", count: 2 }] } },
  "GET /api/v1/journals": { summary: "List private journals", description: moduleDoc("Returns private journal entries for current user only."), successMessage: "Journals retrieved successfully", ...successArray("Journal") },
  "POST /api/v1/journals": { summary: "Create private journal", description: moduleDoc("Creates private journal entry. Journal content is sensitive and owner-only."), requestBody: body(requestSchemas.Journal, { reflection: { content: "Today I stayed consistent." } }), successStatus: "201", successMessage: "Journal created successfully", ...successData("Journal") },
  "GET /api/v1/community": { summary: "List community posts", description: moduleDoc("Returns community post feed for authenticated users."), successMessage: "Community posts retrieved successfully", ...successArray("CommunityPost") },
  "POST /api/v1/community": { summary: "Create community post", description: moduleDoc("Creates community post. MVP moderation is lightweight; keep content safe."), requestBody: body(requestSchemas.CommunityPost, { progress: { category: "progress", content: "I kept my routine today." } }), successStatus: "201", successMessage: "Community post created successfully", ...successData("CommunityPost") },
  "GET /api/v1/community/:postId/comments": { summary: "List community comments", description: moduleDoc("Returns comments for a community post."), successMessage: "Community comments retrieved successfully", ...successArray("CommunityComment") },
  "POST /api/v1/community/:postId/comments": { summary: "Create community comment", description: moduleDoc("Adds comment to a community post."), requestBody: body(requestSchemas.CommunityComment, { support: { content: "You are not alone." } }), successStatus: "201", successMessage: "Community comment created successfully", ...successData("CommunityComment") },
  "POST /api/v1/community/:postId/like": { summary: "Like community post", description: moduleDoc("Toggles/records like for current user and returns updated post counters."), successMessage: "Community post liked successfully", ...successData("CommunityPost") },
  "GET /api/v1/education": { summary: "List education content", description: moduleDoc("Returns seeded education content catalog."), successMessage: "Education content retrieved successfully", ...successArray("EducationContent") },
  "GET /api/v1/content/daily": { summary: "Read daily content", description: moduleDoc("Returns daily motivation/challenge content."), successMessage: "Daily content retrieved successfully", ...successData("DailyContent") },
  "GET /api/v1/achievements/catalog": { summary: "List achievement catalog", description: moduleDoc("Returns achievement definitions used by progress tracking."), successMessage: "Achievement catalog retrieved successfully", ...successArray("Achievement") },
  "GET /api/v1/achievements/progress": { summary: "Read achievement progress", description: moduleDoc("Returns achievement progress for current user."), successMessage: "Achievement progress retrieved successfully", ...successArray("AchievementProgress") },
  "GET /api/v1/achievements/unlocked": { summary: "List unlocked achievements", description: moduleDoc("Returns achievements already unlocked by current user."), successMessage: "Unlocked achievements retrieved successfully", ...successArray("AchievementProgress") },
  "POST /api/v1/ai/ask-coach": { summary: "Ask AI coach", description: moduleDoc("Generates non-streaming supportive response. Does not diagnose, replace professional help, or expose raw sensitive data in errors."), requestBody: body(requestSchemas.AskCoach, { support: { message: "I feel triggered after work." } }), successMessage: "AI coach response generated successfully", ...successData("AiCoachResponse") },
  "POST /api/v1/ai/relapse-solution": { summary: "Ask AI relapse solution", description: moduleDoc("Generates safe relapse support actions from current situation and optional triggers."), requestBody: body(requestSchemas.RelapseSolution, { support: { situation: "Late-night urge after stress.", triggers: ["stress"] } }), successMessage: "Relapse solution generated successfully", ...successData("AiCoachResponse") },
  "POST /api/v1/ai/relapse-prevention-plan": { summary: "Create relapse prevention plan", description: moduleDoc("Returns structured delay, distract, and decide guidance with safety boundary copy."), requestBody: body(requestSchemas.RelapsePreventionPlan, { plan: { urgeLevel: 4, triggers: ["stress"], currentContext: "At home at night." } }), successMessage: "Relapse prevention plan generated successfully", ...successData("RelapsePreventionPlan") },
  "GET /api/v1/ai/chat-history": { summary: "Read AI chat history", description: moduleDoc("Returns current user's AI conversation history only."), successMessage: "AI chat history retrieved successfully", successSchema: { type: "array", items: ref("AiCoachResponse") }, successExample: [schemaExamples.AiCoachResponse] },
  "GET /api/v1/ai/summary": { summary: "Read AI summary", description: moduleDoc("Returns short summary based on recent owned activity."), successMessage: "AI summary retrieved successfully", successSchema: { type: "object", required: ["summary", "safetyNotice"], properties: { summary: { type: "string", example: "You checked in consistently this week." }, safetyNotice: { type: "string", example: "Pulih AI does not replace emergency or professional care." } } }, successExample: { summary: "You checked in consistently this week.", safetyNotice: "Pulih AI does not replace emergency or professional care." } },
  "POST /api/v1/ai/onboarding-analysis": { summary: "Analyze onboarding data", description: moduleDoc("Analyzes onboarding input for non-diagnostic personalization."), requestBody: body(requestSchemas.OnboardingAnalysis, { analysis: { recoveryGoal: "Build a daily recovery streak.", concerns: ["stress"], preferredSupport: "Gentle reminders." } }), successMessage: "Onboarding analysis generated successfully", ...successData("AiCoachResponse") },
  "GET /api/v1/ai/persona-preferences": { summary: "Read AI persona preferences", description: moduleDoc("Returns current user's AI tone and focus preferences."), successMessage: "AI persona preferences retrieved successfully", successSchema: requestSchemas.PersonaPreferences, successExample: { tone: "gentle", focusAreas: ["daily check-in", "relapse prevention"] } },
  "PUT /api/v1/ai/persona-preferences": { summary: "Update AI persona preferences", description: moduleDoc("Updates current user's AI tone and focus preferences."), requestBody: body(requestSchemas.PersonaPreferences, { gentle: { tone: "gentle", focusAreas: ["daily check-in", "relapse prevention"] } }), successMessage: "AI persona preferences updated successfully", successSchema: requestSchemas.PersonaPreferences, successExample: { tone: "gentle", focusAreas: ["daily check-in", "relapse prevention"] } },
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
    if (item.path === "/api/v1/auth/register") return [400, 409, 422, 429, 500];
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

  if (path === "/api/v1/auth/register") {
    if (status === 400) return { code: "BAD_REQUEST", message: "Request body is malformed.", details: ["Request body must be valid JSON."] };
    if (status === 409) return { code: "CONFLICT", message: "Email already registered.", details: ["email: Email is already registered."] };
    if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["email: Email must be valid.", "password: Password must be at least 8 characters."] };
    if (status === 429) return { code: "RATE_LIMITED", message: "Too many registration attempts.", details: ["Too many registration attempts. Please retry later."] };
    if (status === 500) return { code: "INTERNAL_ERROR", message: "Unexpected internal error.", details: ["Failed to create auth account."] };
  }

  if (path === "/api/v1/auth/login") {
    if (status === 400) return { code: "BAD_REQUEST", message: "Request body is malformed.", details: ["Request body must be valid JSON."] };
    if (status === 401) return { code: "UNAUTHENTICATED", message: "Invalid credentials.", details: ["Email or password is invalid."] };
    if (status === 422) return { code: "VALIDATION_ERROR", message: "Request validation failed.", details: ["email: Email must be valid.", "password: Password is required."] };
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
  const operation: Record<string, unknown> = { tags: [getTag(item.path)], summary: contract.summary, description: contract.description, operationId: toOperationId(item.method, item.path), responses: responses(item, contract), "x-codeSamples": [{ lang: "Shell", label: "cURL", source: `curl -X ${item.method} ${apiServerUrl}${toOpenApiPath(item.path)}` }] };
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
  servers: [{ url: apiServerUrl, description: "Local development server" }],
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

export function getOpenApiJson() {
  return pulihOpenApi;
}
export function getOpenApiPaths() {
  return Object.keys(pulihOpenApi.paths);
}
