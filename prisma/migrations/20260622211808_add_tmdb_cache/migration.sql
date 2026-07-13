-- CreateTable
CREATE TABLE "TmdbCache" (
    "id" SERIAL NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "payload" JSONB NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TmdbCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TmdbCache_cacheKey_key" ON "TmdbCache"("cacheKey");

-- CreateIndex
CREATE INDEX "TmdbCache_path_idx" ON "TmdbCache"("path");

-- CreateIndex
CREATE INDEX "TmdbCache_updatedAt_idx" ON "TmdbCache"("updatedAt");
