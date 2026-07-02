-- AlterTable
ALTER TABLE "listings" ADD COLUMN "conjunto" TEXT;

-- CreateIndex
CREATE INDEX "listings_conjunto_idx" ON "listings"("conjunto");
