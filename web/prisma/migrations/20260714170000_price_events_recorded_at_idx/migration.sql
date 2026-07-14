CREATE INDEX IF NOT EXISTS listing_price_events_recorded_at_idx
  ON listing_price_events (recorded_at DESC);
