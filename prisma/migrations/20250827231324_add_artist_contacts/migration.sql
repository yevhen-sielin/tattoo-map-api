-- AlterTable
ALTER TABLE "public"."Artist" ADD COLUMN     "coverups" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "snapchat" TEXT,
ADD COLUMN     "telegram" TEXT,
ADD COLUMN     "tiktok" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "wechat" TEXT,
ADD COLUMN     "whatsapp" TEXT;
