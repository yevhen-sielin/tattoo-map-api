-- Enable PostGIS extension (supported on AWS RDS PostgreSQL out of the box)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add a geography column for spatial queries.
-- geography(Point, 4326) = WGS84 lat/lon, distances in metres.
ALTER TABLE "Artist" ADD COLUMN "location" geography(Point, 4326);

-- Back-fill from existing lat/lon Decimal columns
UPDATE "Artist"
SET "location" = ST_SetSRID(ST_MakePoint("lon"::double precision, "lat"::double precision), 4326)::geography
WHERE "lat" IS NOT NULL AND "lon" IS NOT NULL;

-- GiST index for fast spatial lookups (ST_DWithin, &&, <->)
CREATE INDEX "idx_artist_location" ON "Artist" USING GIST ("location");
