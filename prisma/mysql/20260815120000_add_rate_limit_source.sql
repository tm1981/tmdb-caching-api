ALTER TABLE `ApiRequestLog`
  ADD COLUMN `rateLimitSource` VARCHAR(16) NULL,
  ADD INDEX `ApiRequestLog_rateLimitSource_createdAt_idx` (`rateLimitSource`, `createdAt`);
