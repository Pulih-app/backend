-- check_ins: mood integer -> varchar(50), note -> commitment, add is_successful
ALTER TABLE "check_ins" DROP CONSTRAINT "ck_check_ins_mood";
ALTER TABLE "check_ins" ALTER COLUMN "mood" SET DATA TYPE varchar(50) USING mood::text;
ALTER TABLE "check_ins" RENAME COLUMN "note" TO "commitment";
ALTER TABLE "check_ins" ADD COLUMN "is_successful" boolean NOT NULL DEFAULT true;

-- relapses: mood integer -> varchar(50), note -> commitment, add check_in_id FK, add unique constraint
ALTER TABLE "relapses" DROP CONSTRAINT "ck_relapses_mood";
ALTER TABLE "relapses" ALTER COLUMN "mood" SET DATA TYPE varchar(50) USING mood::text;
ALTER TABLE "relapses" RENAME COLUMN "note" TO "commitment";
ALTER TABLE "relapses" ADD COLUMN "check_in_id" uuid REFERENCES "check_ins"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX "uq_relapses_user_local_date" ON "relapses" ("user_id", "local_date");
