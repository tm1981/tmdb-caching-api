CREATE TABLE "BlockedIp" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedIp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlockedIp_address_key" ON "BlockedIp"("address");
CREATE INDEX "ApiRequestLog_createdAt_ipAddress_idx" ON "ApiRequestLog"("createdAt", "ipAddress");
