ALTER TABLE "bookings" ADD COLUMN "complaint" text NOT NULL DEFAULT 'Keluhan belum diisi';
ALTER TABLE "bookings" ALTER COLUMN "complaint" DROP DEFAULT;
