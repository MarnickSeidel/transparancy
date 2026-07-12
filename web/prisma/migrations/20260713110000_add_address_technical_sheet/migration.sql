-- Full listing address and technical sheet from Finca Raíz JSON.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS address VARCHAR(500);
ALTER TABLE listings ADD COLUMN IF NOT EXISTS technical_sheet JSONB;
