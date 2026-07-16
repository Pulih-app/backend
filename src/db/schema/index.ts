import { relations } from "drizzle-orm";
import { boolean, check, index, integer, pgEnum, pgTable, text, time, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["patient", "psychologist", "admin"]);
export const psychologistTypeEnum = pgEnum("psychologist_type", ["general", "clinical"]);
export const consultationChannelEnum = pgEnum("consultation_channel", ["chat", "chat_and_meet"]);
export const psychologistApprovalStatusEnum = pgEnum("psychologist_approval_status", ["draft", "pending_review", "approved", "rejected"]);
export const credentialDocumentTypeEnum = pgEnum("credential_document_type", ["sipp", "ijazah", "str", "strpk", "sippk"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("patient"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  emailUnique: uniqueIndex("uq_users_email").on(table.email),
}));

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 255 }),
  nickname: varchar("nickname", { length: 255 }),
  recoveryGoal: text("recovery_goal"),
  checkInTime: time("check_in_time", { withTimezone: false }),
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

export const schema = {
  users,
  profiles,
  psychologistProfiles,
  psychologistCredentialFiles,
  psychologistPracticePlaces,
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
