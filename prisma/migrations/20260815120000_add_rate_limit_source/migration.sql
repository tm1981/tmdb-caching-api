ALTER TABLE "ApiRequestLog" ADD COLUMN "rateLimitSource" TEXT;

CREATE INDEX "ApiRequestLog_rateLimitSource_createdAt_idx"
ON "ApiRequestLog"("rateLimitSource", "createdAt");
