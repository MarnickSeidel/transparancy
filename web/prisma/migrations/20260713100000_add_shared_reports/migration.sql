CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  lang TEXT NOT NULL DEFAULT 'es',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS shared_reports_created_at_idx ON shared_reports (created_at DESC);

ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;
