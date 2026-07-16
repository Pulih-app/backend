import { relations, sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, time, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["patient", "psychologist", "admin"]);
export const psychologistTypeEnum = pgEnum("psychologist_type", ["general", "clinical"]);
export const consultationChannelEnum = pgEnum("consultation_channel", ["chat", "chat_and_meet"]);
export const psychologistApprovalStatusEnum = pgEnum("psychologist_approval_status", ["draft", "pending_review", "approved", "rejected", "suspended"]);
export const credentialDocumentTypeEnum = pgEnum("credential_document_type", ["sipp", "ijazah", "str", "strpk", "sippk"]);
export const generatedSessionStatusEnum = pgEnum("generated_session_status", ["available", "held", "booked", "completed", "cancelled", "expired", "rescheduled"]);
export const bookingStatusEnum = pgEnum("booking_status", ["draft", "pending_payment", "payment_completed", "confirmed", "reschedule_requested", "rescheduled", "cancelled", "expired", "completed", "no_show"]);
export const paymentStatusEnum = pgEnum("payment_status", ["created", "pending", "completed", "failed", "expired", "cancelled"]);
export const notificationEventTypeEnum = pgEnum("notification_event_type", ["payment_success_patient", "booking_received_psychologist", "booking_confirmed_session_ready", "booking_rescheduled"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed", "retrying", "cancelled"]);
export const communityPostCategoryEnum = pgEnum("community_post_category", ["advice", "motivation", "story", "question", "help"]);

export const aiChatRoleEnum = pgEnum("ai_chat_role", ["user", "assistant"]);
export const aiPersonaToneEnum = pgEnum("ai_persona_tone", ["supportive", "friendly", "concise", "direct"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 50 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  pornFreeGoal: integer("porn_free_goal"),
  role: userRoleEnum("role").notNull().default("patient"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  emailUnique: uniqueIndex("uq_users_email").on(table.email),
  usernameUnique: uniqueIndex("uq_users_username").on(table.username),
}));

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nickname: varchar("nickname", { length: 255 }),
  recoveryReason: text("recovery_reason"),
  dailyCheckinTime: time("daily_checkin_time", { withTimezone: false }),
  answers: jsonb("answers").notNull().default(sql`'{}'::jsonb`),
  dependencyLevel: varchar("dependency_level", { length: 64 }),
  aiSummary: text("ai_summary"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  userUnique: uniqueIndex("uq_profiles_user_id").on(table.userId),
  userIndex: index("idx_profiles_user_id").on(table.userId),
}));

export const psychologistProfiles = pgTable("psychologist_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: psychologistTypeEnum("type").notNull(),
  consultationChannel: consultationChannelEnum("consultation_channel").notNull(),
  approvalStatus: psychologistApprovalStatusEnum("approval_status").notNull().default("draft"),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  licenseNumber: varchar("license_number", { length: 128 }),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  userUnique: uniqueIndex("uq_psychologist_profiles_user_id").on(table.userId),
  userIndex: index("idx_psychologist_profiles_user_id").on(table.userId),
  channelMatchesType: check("ck_psychologist_channel_matches_type", sql`(${table.type} = 'general' AND ${table.consultationChannel} = 'chat') OR (${table.type} = 'clinical' AND ${table.consultationChannel} = 'chat_and_meet')`),
}));

export const psychologistCredentialFiles = pgTable("psychologist_credential_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => psychologistProfiles.id, { onDelete: "cascade" }),
  documentType: credentialDocumentTypeEnum("document_type").notNull(),
  objectKey: text("object_key").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 128 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  profileIndex: index("idx_psychologist_credential_files_profile_id").on(table.profileId),
  objectKeyUnique: uniqueIndex("uq_psychologist_credential_files_object_key").on(table.objectKey),
}));

export const psychologistPracticePlaces = pgTable("psychologist_practice_places", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => psychologistProfiles.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  profileIndex: index("idx_psychologist_practice_places_profile_id").on(table.profileId),
}));

export const psychologistSessionBundles = pgTable("psychologist_session_bundles", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => psychologistProfiles.id, { onDelete: "cascade" }),
  packageName: varchar("package_name", { length: 255 }).notNull(),
  packageDurationMinutes: integer("package_duration_minutes").notNull(),
  priceAmount: numeric("price_amount", { precision: 12, scale: 2 }).notNull(),
  dateStart: timestamp("date_start", { withTimezone: true, mode: "date" }).notNull(),
  dateEnd: timestamp("date_end", { withTimezone: true, mode: "date" }).notNull(),
  dailyStartTime: time("daily_start_time", { withTimezone: false }).notNull(),
  dailyEndTime: time("daily_end_time", { withTimezone: false }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  profileIndex: index("idx_psychologist_session_bundles_profile_id").on(table.profileId),
  dateRangeIndex: index("idx_psychologist_session_bundles_date_range").on(table.dateStart, table.dateEnd),
  dateRangeCheck: check("ck_psychologist_session_bundles_date_range", sql`${table.dateStart} <= ${table.dateEnd}`),
  timeRangeCheck: check("ck_psychologist_session_bundles_time_range", sql`${table.dailyStartTime} < ${table.dailyEndTime}`),
  durationCheck: check("ck_psychologist_session_bundles_duration", sql`${table.packageDurationMinutes} > 0`),
}));

export const psychologistSessionSlots = pgTable("psychologist_session_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  bundleId: uuid("bundle_id").notNull().references(() => psychologistSessionBundles.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => psychologistProfiles.id, { onDelete: "cascade" }),
  sessionDate: timestamp("session_date", { withTimezone: true, mode: "date" }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
  status: generatedSessionStatusEnum("status").notNull().default("available"),
  heldUntil: timestamp("held_until", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  bundleIndex: index("idx_psychologist_session_slots_bundle_id").on(table.bundleId),
  profileIndex: index("idx_psychologist_session_slots_profile_id").on(table.profileId),
  sessionIndex: index("idx_psychologist_session_slots_session_date").on(table.sessionDate, table.startsAt, table.endsAt),
  timeRangeCheck: check("ck_psychologist_session_slots_time_range", sql`${table.startsAt} < ${table.endsAt}`),
}));

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientUserId: uuid("patient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  psychologistProfileId: uuid("psychologist_profile_id").notNull().references(() => psychologistProfiles.id, { onDelete: "cascade" }),
  sessionSlotId: uuid("session_slot_id").notNull().references(() => psychologistSessionSlots.id, { onDelete: "restrict" }),
  consultationChannel: consultationChannelEnum("consultation_channel").notNull(),
  status: bookingStatusEnum("status").notNull().default("pending_payment"),
  scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true, mode: "date" }).notNull(),
  scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true, mode: "date" }).notNull(),
  priceAmount: numeric("price_amount", { precision: 12, scale: 2 }).notNull(),
  packageNameSnapshot: varchar("package_name_snapshot", { length: 255 }).notNull(),
  packageDurationMinutesSnapshot: integer("package_duration_minutes_snapshot").notNull(),
  paymentExpiresAt: timestamp("payment_expires_at", { withTimezone: true, mode: "date" }).notNull(),
  meetLink: text("meet_link"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
  rescheduledAt: timestamp("rescheduled_at", { withTimezone: true, mode: "date" }),
  rescheduleReason: text("reschedule_reason"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  patientIndex: index("idx_bookings_patient_user_id").on(table.patientUserId),
  psychologistIndex: index("idx_bookings_psychologist_profile_id").on(table.psychologistProfileId),
  sessionUnique: uniqueIndex("uq_bookings_session_slot_id").on(table.sessionSlotId),
  paymentExpiresIndex: index("idx_bookings_payment_expires_at").on(table.paymentExpiresAt),
  timeRangeCheck: check("ck_bookings_time_range", sql`${table.scheduledStartAt} < ${table.scheduledEndAt}`),
}));

export const bookingStatusEvents = pgTable("booking_status_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  fromStatus: bookingStatusEnum("from_status"),
  toStatus: bookingStatusEnum("to_status").notNull(),
  reason: text("reason"),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  bookingIndex: index("idx_booking_status_events_booking_id").on(table.bookingId),
}));

export const bookingMessages = pgTable("booking_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  senderUserId: uuid("sender_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  bookingIndex: index("idx_booking_messages_booking_id").on(table.bookingId),
  senderIndex: index("idx_booking_messages_sender_user_id").on(table.senderUserId),
}));

export const bookingReviews = pgTable("booking_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  patientUserId: uuid("patient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  psychologistProfileId: uuid("psychologist_profile_id").notNull().references(() => psychologistProfiles.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  bookingUnique: uniqueIndex("uq_booking_reviews_booking_id").on(table.bookingId),
  psychologistIndex: index("idx_booking_reviews_psychologist_profile_id").on(table.psychologistProfileId),
  ratingCheck: check("ck_booking_reviews_rating", sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
}));

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 64 }).notNull(),
  orderId: varchar("order_id", { length: 128 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: paymentStatusEnum("status").notNull().default("created"),
  paymentMethod: varchar("payment_method", { length: 64 }),
  paymentUrl: text("payment_url"),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  providerMetadata: jsonb("provider_metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  bookingUnique: uniqueIndex("uq_payments_booking_id").on(table.bookingId),
  orderUnique: uniqueIndex("uq_payments_order_id").on(table.orderId),
  statusIndex: index("idx_payments_status").on(table.status),
  expiresIndex: index("idx_payments_expires_at").on(table.expiresAt),
}));

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  providerStatus: varchar("provider_status", { length: 64 }).notNull(),
  orderId: varchar("order_id", { length: 128 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  rawPayloadSafe: jsonb("raw_payload_safe").notNull().default(sql`'{}'::jsonb`),
}, (table) => ({
  paymentIndex: index("idx_payment_events_payment_id").on(table.paymentId),
  orderIndex: index("idx_payment_events_order_id").on(table.orderId),
}));

export const checkIns = pgTable("check_ins", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mood: varchar("mood", { length: 50 }).notNull(),
  isSuccessful: boolean("is_successful").notNull().default(true),
  commitment: text("commitment"),
  localDate: date("local_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  userDateUnique: uniqueIndex("uq_check_ins_user_local_date").on(table.userId, table.localDate),
  userDateIndex: index("idx_check_ins_user_local_date").on(table.userId, table.localDate),
}));

export const relapses = pgTable("relapses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mood: varchar("mood", { length: 50 }).notNull(),
  triggers: text("triggers").array().notNull(),
  commitment: text("commitment"),
  checkInId: uuid("check_in_id").references(() => checkIns.id, { onDelete: "set null" }),
  localDate: date("local_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  userDateUnique: uniqueIndex("uq_relapses_user_local_date").on(table.userId, table.localDate),
  userDateIndex: index("idx_relapses_user_local_date").on(table.userId, table.localDate),
}));

export const streaks = pgTable("streaks", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastCheckInLocalDate: date("last_check_in_local_date", { mode: "string" }),
  lastRelapseLocalDate: date("last_relapse_local_date", { mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  currentCheck: check("ck_streaks_current_non_negative", sql`${table.currentStreak} >= 0`),
  longestCheck: check("ck_streaks_longest_non_negative", sql`${table.longestStreak} >= 0`),
}));

export const journals = pgTable("journals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({ userIndex: index("idx_journals_user_id").on(table.userId) }));

export const communityPosts = pgTable("community_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 120 }),
  category: communityPostCategoryEnum("category").notNull(),
  content: text("content").notNull(),
  likeCount: integer("like_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({ userIndex: index("idx_community_posts_user_id").on(table.userId) }));

export const communityComments = pgTable("community_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentCommentId: uuid("parent_comment_id"),
  content: text("content").notNull(),
  depth: integer("depth").notNull().default(0),
  replyCount: integer("reply_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  postIndex: index("idx_community_comments_post_id").on(table.postId),
  userIndex: index("idx_community_comments_user_id").on(table.userId),
  parentIndex: index("idx_community_comments_parent_id").on(table.parentCommentId),
}));

export const communityPostLikes = pgTable("community_post_likes", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({ postUserUnique: uniqueIndex("uq_community_post_likes_post_user").on(table.postId, table.userId) }));

export const educationContents = pgTable("education_contents", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  url: text("url").notNull().default(""),
  thumbnailUrl: text("thumbnail_url"),
  category: varchar("category", { length: 64 }).notNull(),
  type: varchar("type", { length: 32 }).notNull().default("artikel"),
  isActive: boolean("is_active").notNull().default(true),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const dailyMotivations = pgTable("daily_motivations", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const dailyChallenges = pgTable("daily_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  content: text("content").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const achievements = pgTable("achievements", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 128 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  criteria: jsonb("criteria").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({ keyUnique: uniqueIndex("uq_achievements_key").on(table.key) }));

export const userAchievementProgress = pgTable("user_achievement_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: uuid("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  progressValue: integer("progress_value").notNull().default(0),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: "date" }),
}, (table) => ({ userAchievementUnique: uniqueIndex("uq_user_achievement_progress_user_achievement").on(table.userId, table.achievementId) }));

export const aiChatMessages = pgTable("ai_chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: aiChatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({ userCreatedIndex: index("idx_ai_chat_messages_user_created").on(table.userId, table.createdAt) }));

export const aiPersonaPreferences = pgTable("ai_persona_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  persona: aiPersonaToneEnum("persona").notNull().default("supportive"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const notificationEvents = pgTable("notification_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: notificationEventTypeEnum("type").notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  relatedBookingId: uuid("related_booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  status: notificationStatusEnum("status").notNull().default("pending"),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  lastError: text("last_error"),
  attemptCount: integer("attempt_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
}, (table) => ({
  bookingTypeUnique: uniqueIndex("uq_notification_events_booking_type").on(table.relatedBookingId, table.type),
  bookingIndex: index("idx_notification_events_booking_id").on(table.relatedBookingId),
  statusIndex: index("idx_notification_events_status").on(table.status),
}));

export const dailyPhysicalChallenges = pgTable("daily_physical_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  titleDescUnique: uniqueIndex("uq_daily_physical_challenges_title_description").on(table.title, table.description),
}));

export const schema = {
  users,
  profiles,
  psychologistProfiles,
  psychologistCredentialFiles,
  psychologistPracticePlaces,
  psychologistSessionBundles,
  psychologistSessionSlots,
  bookings,
  bookingStatusEvents,
  bookingMessages,
  bookingReviews,
  payments,
  paymentEvents,
  checkIns,
  relapses,
  streaks,
  aiChatMessages,
  aiPersonaPreferences,
  notificationEvents,
  journals,
  communityPosts,
  communityComments,
  communityPostLikes,
  educationContents,
  dailyMotivations,
  dailyChallenges,
  dailyPhysicalChallenges,
  achievements,
  userAchievementProgress,
} as const;

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));
