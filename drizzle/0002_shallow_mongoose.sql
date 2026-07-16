CREATE TYPE "public"."booking_status" AS ENUM('draft', 'pending_payment', 'payment_completed', 'confirmed', 'reschedule_requested', 'rescheduled', 'cancelled', 'expired', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."generated_session_status" AS ENUM('available', 'held', 'booked', 'completed', 'cancelled', 'expired', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'pending', 'completed', 'failed', 'expired', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."psychologist_approval_status" ADD VALUE 'suspended';--> statement-breakpoint
CREATE TABLE "booking_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"psychologist_profile_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_booking_reviews_rating" CHECK ("booking_reviews"."rating" >= 1 AND "booking_reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "booking_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"reason" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"psychologist_profile_id" uuid NOT NULL,
	"session_slot_id" uuid NOT NULL,
	"consultation_channel" "consultation_channel" NOT NULL,
	"status" "booking_status" DEFAULT 'pending_payment' NOT NULL,
	"scheduled_start_at" timestamp with time zone NOT NULL,
	"scheduled_end_at" timestamp with time zone NOT NULL,
	"price_amount" numeric(12, 2) NOT NULL,
	"package_name_snapshot" varchar(255) NOT NULL,
	"package_duration_minutes_snapshot" integer NOT NULL,
	"payment_expires_at" timestamp with time zone NOT NULL,
	"meet_link" text,
	"confirmed_at" timestamp with time zone,
	"rescheduled_at" timestamp with time zone,
	"reschedule_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_bookings_time_range" CHECK ("bookings"."scheduled_start_at" < "bookings"."scheduled_end_at")
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"provider_status" varchar(64) NOT NULL,
	"order_id" varchar(128) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"raw_payload_safe" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"order_id" varchar(128) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"payment_method" varchar(64),
	"payment_url" text,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"provider_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psychologist_session_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"package_name" varchar(255) NOT NULL,
	"package_duration_minutes" integer NOT NULL,
	"price_amount" numeric(12, 2) NOT NULL,
	"date_start" timestamp with time zone NOT NULL,
	"date_end" timestamp with time zone NOT NULL,
	"daily_start_time" time NOT NULL,
	"daily_end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_psychologist_session_bundles_date_range" CHECK ("psychologist_session_bundles"."date_start" <= "psychologist_session_bundles"."date_end"),
	CONSTRAINT "ck_psychologist_session_bundles_time_range" CHECK ("psychologist_session_bundles"."daily_start_time" < "psychologist_session_bundles"."daily_end_time"),
	CONSTRAINT "ck_psychologist_session_bundles_duration" CHECK ("psychologist_session_bundles"."package_duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "psychologist_session_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"session_date" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "generated_session_status" DEFAULT 'available' NOT NULL,
	"held_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_psychologist_session_slots_time_range" CHECK ("psychologist_session_slots"."starts_at" < "psychologist_session_slots"."ends_at")
);
--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reviews" ADD CONSTRAINT "booking_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reviews" ADD CONSTRAINT "booking_reviews_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reviews" ADD CONSTRAINT "booking_reviews_psychologist_profile_id_psychologist_profiles_id_fk" FOREIGN KEY ("psychologist_profile_id") REFERENCES "public"."psychologist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_events" ADD CONSTRAINT "booking_status_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_events" ADD CONSTRAINT "booking_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_psychologist_profile_id_psychologist_profiles_id_fk" FOREIGN KEY ("psychologist_profile_id") REFERENCES "public"."psychologist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_slot_id_psychologist_session_slots_id_fk" FOREIGN KEY ("session_slot_id") REFERENCES "public"."psychologist_session_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychologist_session_bundles" ADD CONSTRAINT "psychologist_session_bundles_profile_id_psychologist_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."psychologist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychologist_session_slots" ADD CONSTRAINT "psychologist_session_slots_bundle_id_psychologist_session_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."psychologist_session_bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychologist_session_slots" ADD CONSTRAINT "psychologist_session_slots_profile_id_psychologist_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."psychologist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_booking_messages_booking_id" ON "booking_messages" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_messages_sender_user_id" ON "booking_messages" USING btree ("sender_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_booking_reviews_booking_id" ON "booking_reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_reviews_psychologist_profile_id" ON "booking_reviews" USING btree ("psychologist_profile_id");--> statement-breakpoint
CREATE INDEX "idx_booking_status_events_booking_id" ON "booking_status_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_patient_user_id" ON "bookings" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_psychologist_profile_id" ON "bookings" USING btree ("psychologist_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bookings_session_slot_id" ON "bookings" USING btree ("session_slot_id");--> statement-breakpoint
CREATE INDEX "idx_bookings_payment_expires_at" ON "bookings" USING btree ("payment_expires_at");--> statement-breakpoint
CREATE INDEX "idx_payment_events_payment_id" ON "payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_payment_events_order_id" ON "payment_events" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_booking_id" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_order_id" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_payments_status" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payments_expires_at" ON "payments" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_psychologist_session_bundles_profile_id" ON "psychologist_session_bundles" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_psychologist_session_bundles_date_range" ON "psychologist_session_bundles" USING btree ("date_start","date_end");--> statement-breakpoint
CREATE INDEX "idx_psychologist_session_slots_bundle_id" ON "psychologist_session_slots" USING btree ("bundle_id");--> statement-breakpoint
CREATE INDEX "idx_psychologist_session_slots_profile_id" ON "psychologist_session_slots" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_psychologist_session_slots_session_date" ON "psychologist_session_slots" USING btree ("session_date","starts_at","ends_at");