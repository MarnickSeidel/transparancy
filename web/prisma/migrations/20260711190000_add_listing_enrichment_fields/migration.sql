-- Enriched listing fields from Finca Raiz search-card JSON (no detail-page fetch).

ALTER TABLE listings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS area_private_m2 DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_m2_private DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS garage INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS floor INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS antiquity INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS accepts_barter BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS construction_state VARCHAR(50);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_id BIGINT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_name VARCHAR(200);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_type VARCHAR(50);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_particular BOOLEAN;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS neighborhood_source_id VARCHAR(120);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS zone_name VARCHAR(100);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS commune_name VARCHAR(100);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS facilities JSONB;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS image_count INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_admin_included BIGINT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS highlight INTEGER;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS relevance DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS paid_quota BOOLEAN;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_project BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS area_mismatch_flag BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS terrace_heavy_flag BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS listings_accepts_barter_idx ON listings (accepts_barter);
CREATE INDEX IF NOT EXISTS listings_zone_name_idx ON listings (zone_name);
CREATE INDEX IF NOT EXISTS listings_owner_id_idx ON listings (owner_id);
CREATE INDEX IF NOT EXISTS listings_area_private_m2_idx ON listings (area_private_m2);
