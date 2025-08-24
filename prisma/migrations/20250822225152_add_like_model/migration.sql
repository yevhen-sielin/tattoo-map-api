-- CreateTable
CREATE TABLE "public"."likes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "likes_artist_id_idx" ON "public"."likes"("artist_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_user_id_artist_id_key" ON "public"."likes"("user_id", "artist_id");

-- AddForeignKey
ALTER TABLE "public"."likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."likes" ADD CONSTRAINT "likes_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "public"."Artist"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
