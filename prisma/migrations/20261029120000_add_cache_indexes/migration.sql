-- CreateIndex
CREATE INDEX "Movie_title_idx" ON "Movie"("title");

-- CreateIndex
CREATE INDEX "Movie_updatedAt_idx" ON "Movie"("updatedAt");

-- CreateIndex
CREATE INDEX "TvShow_name_idx" ON "TvShow"("name");

-- CreateIndex
CREATE INDEX "TvShow_updatedAt_idx" ON "TvShow"("updatedAt");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");

