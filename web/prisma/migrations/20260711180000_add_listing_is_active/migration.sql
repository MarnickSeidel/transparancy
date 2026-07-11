-- Mark listings inactive when not seen during a city refresh (set by scraper).
ALTER TABLE "listings" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "listings_is_active_idx" ON "listings"("is_active");

-- Backfill: treat listings not seen in the last 21 days as inactive immediately.
UPDATE "listings"
SET "is_active" = false
WHERE "last_seen_at" < NOW() - INTERVAL '21 days';
