CREATE TYPE "public"."ai_chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."ai_persona_tone" AS ENUM('gentle', 'direct', 'balanced');--> statement-breakpoint
CREATE TABLE "ai_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "ai_chat_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_persona_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tone" "ai_persona_tone" DEFAULT 'balanced' NOT NULL,
	"focus_areas" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_persona_preferences" ADD CONSTRAINT "ai_persona_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_chat_messages_user_created" ON "ai_chat_messages" USING btree ("user_id","created_at");