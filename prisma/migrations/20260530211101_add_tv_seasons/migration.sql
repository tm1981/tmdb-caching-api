/*
  Warnings:

  - You are about to drop the column `images` on the `Movie` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Movie" DROP COLUMN "images",
ADD COLUMN     "seasons" JSONB;

-- AlterTable
ALTER TABLE "TvShow" ADD COLUMN     "seasons" JSONB;
