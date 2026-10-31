-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "ads" ADD COLUMN     "status" "AdStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ad_images" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "ad_id" INTEGER NOT NULL,

    CONSTRAINT "ad_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_images_filename_key" ON "ad_images"("filename");

-- CreateIndex
CREATE INDEX "ad_images_ad_id_idx" ON "ad_images"("ad_id");

-- AddForeignKey
ALTER TABLE "ad_images" ADD CONSTRAINT "ad_images_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
