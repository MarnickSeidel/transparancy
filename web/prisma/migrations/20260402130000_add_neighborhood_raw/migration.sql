-- Portal zone/barrio label before catalog normalization (display / audit).
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "neighborhood_raw" TEXT;
