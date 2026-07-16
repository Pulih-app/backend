ALTER TABLE "psychologist_profiles" ADD COLUMN "date_of_birth" date;
ALTER TABLE "psychologist_profiles" ADD COLUMN "address" text;
ALTER TABLE "psychologist_profiles" ADD COLUMN "photo_url" text;
ALTER TABLE "psychologist_profiles" DROP COLUMN "license_number";
