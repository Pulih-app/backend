ALTER TABLE "users" ADD COLUMN "username" varchar(50);
ALTER TABLE "users" ADD COLUMN "porn_free_goal" integer;
ALTER TABLE "users" ADD CONSTRAINT "uq_users_username" UNIQUE ("username");

ALTER TABLE "profiles" DROP COLUMN "display_name";
ALTER TABLE "profiles" DROP COLUMN "recovery_goal";
ALTER TABLE "profiles" DROP COLUMN "check_in_time";
ALTER TABLE "profiles" ADD COLUMN "recovery_reason" text;
ALTER TABLE "profiles" ADD COLUMN "daily_checkin_time" time;
ALTER TABLE "profiles" ADD COLUMN "answers" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "profiles" ADD COLUMN "dependency_level" varchar(64);
ALTER TABLE "profiles" ADD COLUMN "ai_summary" text;
