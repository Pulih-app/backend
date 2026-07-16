-- 0011: Align AI persona preferences with Recova reference
-- Changes: rename tone→persona, change enum values, remove focus_areas

-- 1) Drop DEFAULT and change tone column to text for safe value migration
ALTER TABLE "ai_persona_preferences" ALTER COLUMN "tone" DROP DEFAULT;
ALTER TABLE "ai_persona_preferences" ALTER COLUMN "tone" TYPE text;

-- 2) Map old tone values to new persona values
-- gentle → supportive, balanced → concise, direct → direct
UPDATE "ai_persona_preferences"
SET "tone" = CASE
  WHEN "tone" = 'gentle' THEN 'supportive'
  WHEN "tone" = 'balanced' THEN 'concise'
  WHEN "tone" = 'direct' THEN 'direct'
  ELSE 'supportive'
END;

-- 3) Drop focus_areas column (not in reference spec)
ALTER TABLE "ai_persona_preferences" DROP COLUMN IF EXISTS "focus_areas";

-- 4) Rename tone → persona
ALTER TABLE "ai_persona_preferences" RENAME COLUMN "tone" TO "persona";

-- 5) Drop old enum type and create new one
DROP TYPE IF EXISTS "ai_persona_tone";
CREATE TYPE "ai_persona_tone" AS ENUM ('supportive', 'friendly', 'concise', 'direct');

-- 6) Cast persona column to new enum type and set default
ALTER TABLE "ai_persona_preferences"
  ALTER COLUMN "persona" TYPE "ai_persona_tone" USING "persona"::"ai_persona_tone",
  ALTER COLUMN "persona" SET DEFAULT 'supportive';
