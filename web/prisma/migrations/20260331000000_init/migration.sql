-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price_cop" BIGINT NOT NULL,
    "area_m2" DOUBLE PRECISION NOT NULL,
    "estrato" INTEGER,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Pereira',
    "department" TEXT NOT NULL DEFAULT 'Risaralda',
    "price_per_m2" DOUBLE PRECISION,
    "url" TEXT NOT NULL,
    "image_url" TEXT,
    "date_scraped" TIMESTAMP(3) NOT NULL,
    "is_deal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listings_external_id_key" ON "listings"("external_id");

-- CreateIndex
CREATE INDEX "listings_neighborhood_idx" ON "listings"("neighborhood");

-- CreateIndex
CREATE INDEX "listings_estrato_idx" ON "listings"("estrato");

-- CreateIndex
CREATE INDEX "listings_date_scraped_idx" ON "listings"("date_scraped");
