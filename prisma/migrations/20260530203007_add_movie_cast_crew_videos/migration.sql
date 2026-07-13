-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "cast" JSONB,
ADD COLUMN     "crew" JSONB,
ADD COLUMN     "images" JSONB,
ADD COLUMN     "videos" JSONB;
