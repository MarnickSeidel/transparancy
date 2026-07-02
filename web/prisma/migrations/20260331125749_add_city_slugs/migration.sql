-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "city_id" TEXT,
ADD COLUMN     "city_slug" TEXT,
ADD COLUMN     "department_slug" TEXT;

-- CreateIndex
CREATE INDEX "listings_city_idx" ON "listings"("city");

-- CreateIndex
CREATE INDEX "listings_city_id_idx" ON "listings"("city_id");

-- CreateIndex
CREATE INDEX "listings_city_slug_idx" ON "listings"("city_slug");
