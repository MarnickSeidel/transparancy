CREATE TABLE IF NOT EXISTS listing_price_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  price_cop BIGINT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_price_events_listing_id_recorded_at_idx
  ON listing_price_events (listing_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS listing_price_events_external_id_recorded_at_idx
  ON listing_price_events (external_id, recorded_at DESC);
