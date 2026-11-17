-- Normalized seller type: 'particular' (private owner) | 'inmobiliaria' | 'desarrollador'.
-- Derived from Finca Raíz owner.particular / owner.type (already stored as owner_particular / owner_type).
ALTER TABLE listings ADD COLUMN IF NOT EXISTS seller_type VARCHAR(30);

UPDATE listings
SET seller_type = CASE
    WHEN owner_particular IS TRUE THEN 'particular'
    WHEN owner_type IS NOT NULL AND btrim(owner_type) <> '' THEN left(lower(btrim(owner_type)), 30)
    ELSE NULL
  END
WHERE seller_type IS NULL;

CREATE INDEX IF NOT EXISTS listings_seller_type_idx ON listings (seller_type);

-- Keep publisher info when aged listings are archived into thin market facts.
ALTER TABLE listing_market_facts ADD COLUMN IF NOT EXISTS owner_id BIGINT;
ALTER TABLE listing_market_facts ADD COLUMN IF NOT EXISTS seller_type VARCHAR(30);

CREATE INDEX IF NOT EXISTS listing_market_facts_seller_type_idx ON listing_market_facts (seller_type);
