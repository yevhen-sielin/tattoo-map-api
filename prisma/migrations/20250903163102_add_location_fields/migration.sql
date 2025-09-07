-- AlterTable
ALTER TABLE "public"."Artist" ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "geoRaw" JSONB,
ADD COLUMN     "postcode" TEXT,
ADD COLUMN     "regionCode" TEXT,
ADD COLUMN     "regionCodeFull" TEXT,
ADD COLUMN     "regionName" TEXT,
ADD COLUMN     "routableLat" DECIMAL(9,6),
ADD COLUMN     "routableLon" DECIMAL(9,6),
ADD COLUMN     "streetName" TEXT;

-- CreateIndex
CREATE INDEX "Artist_regionCodeFull_idx" ON "public"."Artist"("regionCodeFull");

-- CreateIndex
CREATE INDEX "Artist_city_idx" ON "public"."Artist"("city");

-- CreateIndex
CREATE INDEX "Artist_postcode_idx" ON "public"."Artist"("postcode");

-- CreateIndex
CREATE INDEX "Artist_nickname_idx" ON "public"."Artist"("nickname");

-- CreateIndex
CREATE INDEX "Artist_beginner_color_blackAndGray_idx" ON "public"."Artist"("beginner", "color", "blackAndGray");
