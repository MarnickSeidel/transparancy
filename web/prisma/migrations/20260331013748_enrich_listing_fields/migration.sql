-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "admin_fee_cop" BIGINT,
ADD COLUMN     "area_built_m2" DOUBLE PRECISION,
ADD COLUMN     "area_terrace_m2" DOUBLE PRECISION,
ADD COLUMN     "area_terrain_m2" DOUBLE PRECISION,
ADD COLUMN     "currency_symbol" TEXT,
ADD COLUMN     "data_completeness_score" DOUBLE PRECISION,
ADD COLUMN     "deal_score" DOUBLE PRECISION,
ADD COLUMN     "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_changed_at" TIMESTAMP(3),
ADD COLUMN     "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "location_path" JSONB,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "operation_type" TEXT,
ADD COLUMN     "price_per_m2_built" DOUBLE PRECISION,
ADD COLUMN     "price_per_m2_terrain" DOUBLE PRECISION,
ADD COLUMN     "property_type" TEXT,
ADD COLUMN     "quality_flags" JSONB,
ADD COLUMN     "source_created_at" TIMESTAMP(3),
ADD COLUMN     "source_fingerprint" TEXT,
ADD COLUMN     "source_updated_at" TIMESTAMP(3),
ADD COLUMN     "times_seen" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "listings_property_type_idx" ON "listings"("property_type");

-- CreateIndex
CREATE INDEX "listings_source_updated_at_idx" ON "listings"("source_updated_at");

-- CreateIndex
CREATE INDEX "listings_last_seen_at_idx" ON "listings"("last_seen_at");

-- CreateIndex
CREATE INDEX "listings_source_fingerprint_idx" ON "listings"("source_fingerprint");

-- CreateIndex
CREATE INDEX "listings_latitude_longitude_idx" ON "listings"("latitude", "longitude");
