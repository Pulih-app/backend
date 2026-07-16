-- 0010: Align education_contents, daily_motivations, daily_challenges with Recova reference
-- Adds daily_physical_challenges table
-- Changes were applied manually via psql on 2026-07-16; this file exists for drizzle-kit tracking only.
-- All ALTER/ADD/DROP operations are idempotent guards — upstream migration already ran.

-- 1) education_contents: add Recova-aligned columns
ALTER TABLE "education_contents" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "education_contents" ADD COLUMN IF NOT EXISTS "url" text NOT NULL DEFAULT '';
ALTER TABLE "education_contents" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
ALTER TABLE "education_contents" ADD COLUMN IF NOT EXISTS "type" varchar(32) NOT NULL DEFAULT 'artikel';
ALTER TABLE "education_contents" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "education_contents" DROP COLUMN IF EXISTS "content";
ALTER TABLE "education_contents" DROP COLUMN IF EXISTS "status";
DROP TYPE IF EXISTS "content_status";

-- 2) daily_motivations
ALTER TABLE "daily_motivations" DROP CONSTRAINT IF EXISTS "uq_daily_motivations_local_date";
ALTER TABLE "daily_motivations" DROP COLUMN IF EXISTS "source";
ALTER TABLE "daily_motivations" DROP COLUMN IF EXISTS "local_date";
ALTER TABLE "daily_motivations" DROP COLUMN IF EXISTS "status";
ALTER TABLE "daily_motivations" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "daily_motivations" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "daily_motivations" ADD CONSTRAINT IF NOT EXISTS "uq_daily_motivations_content" UNIQUE ("content");

-- 3) daily_challenges
ALTER TABLE "daily_challenges" DROP CONSTRAINT IF EXISTS "uq_daily_challenges_local_date";
ALTER TABLE "daily_challenges" DROP COLUMN IF EXISTS "category";
ALTER TABLE "daily_challenges" DROP COLUMN IF EXISTS "local_date";
ALTER TABLE "daily_challenges" DROP COLUMN IF EXISTS "status";
ALTER TABLE "daily_challenges" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "daily_challenges" ADD COLUMN IF NOT EXISTS "content" text NOT NULL DEFAULT '';
ALTER TABLE "daily_challenges" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "daily_challenges" ADD CONSTRAINT IF NOT EXISTS "uq_daily_challenges_content" UNIQUE ("content");

-- 4) daily_physical_challenges: new table
CREATE TABLE IF NOT EXISTS "daily_physical_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "description" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_daily_physical_challenges_title_description"
  ON "daily_physical_challenges" ("title", "description");
