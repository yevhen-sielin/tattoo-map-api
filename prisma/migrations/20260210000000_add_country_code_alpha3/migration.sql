-- AlterTable
ALTER TABLE "Artist" ADD COLUMN IF NOT EXISTS "countryCodeAlpha3" VARCHAR(3);
