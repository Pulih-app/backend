CREATE TYPE "public"."consultation_channel" AS ENUM('chat', 'chat_and_meet');--> statement-breakpoint
CREATE TYPE "public"."credential_document_type" AS ENUM('sipp', 'ijazah', 'str', 'strpk', 'sippk');--> statement-breakpoint
CREATE TYPE "public"."psychologist_approval_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."psychologist_type" AS ENUM('general', 'clinical');--> statement-breakpoint
CREATE TABLE "psychologist_credential_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"document_type" "credential_document_type" NOT NULL,
	"object_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psychologist_practice_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psychologist_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "psychologist_type" NOT NULL,
	"consultation_channel" "consultation_channel" NOT NULL,
	"approval_status" "psychologist_approval_status" DEFAULT 'draft' NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"license_number" varchar(128),
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_psychologist_channel_matches_type" CHECK (("psychologist_profiles"."type" = 'general' AND "psychologist_profiles"."consultation_channel" = 'chat') OR ("psychologist_profiles"."type" = 'clinical' AND "psychologist_profiles"."consultation_channel" = 'chat_and_meet'))
);
--> statement-breakpoint
ALTER TABLE "psychologist_credential_files" ADD CONSTRAINT "psychologist_credential_files_profile_id_psychologist_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."psychologist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychologist_practice_places" ADD CONSTRAINT "psychologist_practice_places_profile_id_psychologist_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."psychologist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychologist_profiles" ADD CONSTRAINT "psychologist_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_psychologist_credential_files_profile_id" ON "psychologist_credential_files" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_psychologist_credential_files_object_key" ON "psychologist_credential_files" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "idx_psychologist_practice_places_profile_id" ON "psychologist_practice_places" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_psychologist_profiles_user_id" ON "psychologist_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_psychologist_profiles_user_id" ON "psychologist_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."check_psychologist_practice_place_limit"() RETURNS trigger AS $$
DECLARE
  profile_type "public"."psychologist_type";
  active_count integer;
BEGIN
  SELECT type INTO profile_type FROM "public"."psychologist_profiles" WHERE id = NEW."profile_id";

  IF profile_type = 'clinical' AND NEW."is_active" THEN
    SELECT COUNT(*) INTO active_count
    FROM "public"."psychologist_practice_places"
    WHERE "profile_id" = NEW."profile_id"
      AND "is_active" = true
      AND (TG_OP <> 'UPDATE' OR "id" <> NEW."id");

    IF active_count >= 3 THEN
      RAISE EXCEPTION 'Clinical psychologist can have at most 3 active practice places.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_check_psychologist_practice_place_limit" BEFORE INSERT OR UPDATE ON "psychologist_practice_places" FOR EACH ROW EXECUTE FUNCTION "public"."check_psychologist_practice_place_limit"();