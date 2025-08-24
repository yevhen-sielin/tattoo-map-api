-- AlterTable: add independent flags for work types and beginner status
ALTER TABLE "public"."Artist"
  ADD COLUMN IF NOT EXISTS "beginner" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "color" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blackAndGray" BOOLEAN NOT NULL DEFAULT false;

