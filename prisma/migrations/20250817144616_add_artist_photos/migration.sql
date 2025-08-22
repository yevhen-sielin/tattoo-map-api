-- AlterTable
ALTER TABLE "public"."Artist" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
