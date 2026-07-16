CREATE TYPE "public"."notification_event_type" AS ENUM('payment_success_patient', 'booking_received_psychologist', 'booking_confirmed_session_ready', 'booking_rescheduled');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'retrying', 'cancelled');--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_event_type" NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"related_booking_id" uuid NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" varchar(255),
	"last_error" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_related_booking_id_bookings_id_fk" FOREIGN KEY ("related_booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notification_events_booking_type" ON "notification_events" USING btree ("related_booking_id","type");--> statement-breakpoint
CREATE INDEX "idx_notification_events_booking_id" ON "notification_events" USING btree ("related_booking_id");--> statement-breakpoint
CREATE INDEX "idx_notification_events_status" ON "notification_events" USING btree ("status");