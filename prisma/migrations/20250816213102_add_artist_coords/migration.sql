-- AlterTable
ALTER TABLE "public"."Artist" ADD COLUMN     "countryCode" VARCHAR(2),
ADD COLUMN     "lat" DECIMAL(9,6),
ADD COLUMN     "lon" DECIMAL(9,6),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Artist_countryCode_idx" ON "public"."Artist"("countryCode");

-- CreateIndex
CREATE INDEX "Artist_lat_lon_idx" ON "public"."Artist"("lat", "lon");
