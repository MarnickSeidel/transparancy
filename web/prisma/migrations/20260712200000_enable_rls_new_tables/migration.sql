-- Enable RLS on tables added after 20260707190000_enable_rls.
-- Same policy as earlier migration: no public API policies; Prisma owner bypasses RLS.

ALTER TABLE "public"."listing_price_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."monthly_market_snapshots" ENABLE ROW LEVEL SECURITY;
