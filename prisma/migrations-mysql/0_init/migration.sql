-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'admin',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiKey` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `keyHash` VARCHAR(191) NULL,
    `keyPrefix` VARCHAR(191) NOT NULL DEFAULT '',
    `label` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `ownerId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ApiKey_keyHash_key`(`keyHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiRequestLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `apiKeyId` INTEGER NULL,
    `apiKeyLabel` VARCHAR(191) NULL,
    `apiKeyPrefix` VARCHAR(191) NOT NULL DEFAULT '',
    `method` VARCHAR(191) NOT NULL DEFAULT 'GET',
    `endpoint` VARCHAR(512) NOT NULL,
    `query` TEXT NOT NULL,
    `status` INTEGER NOT NULL,
    `durationMs` INTEGER NOT NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `countryCode` VARCHAR(2) NULL,
    `cacheStatus` VARCHAR(16) NULL,
    `rateLimitSource` VARCHAR(16) NULL,
    `hourBucket` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApiRequestLog_createdAt_idx`(`createdAt`),
    INDEX `ApiRequestLog_createdAt_ipAddress_idx`(`createdAt`, `ipAddress`),
    INDEX `ApiRequestLog_hourBucket_idx`(`hourBucket`),
    INDEX `ApiRequestLog_apiKeyId_createdAt_idx`(`apiKeyId`, `createdAt`),
    INDEX `ApiRequestLog_rateLimitSource_createdAt_idx`(`rateLimitSource`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockedIp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `address` VARCHAR(45) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BlockedIp_address_key`(`address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Movie` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tmdbId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `originalTitle` VARCHAR(191) NOT NULL,
    `overview` TEXT NULL,
    `posterPath` VARCHAR(191) NULL,
    `backdropPath` VARCHAR(191) NULL,
    `releaseDate` DATETIME(3) NULL,
    `runtime` INTEGER NULL,
    `voteAverage` DOUBLE NULL,
    `voteCount` INTEGER NULL,
    `genres` JSON NULL,
    `productionCompanies` JSON NULL,
    `spokenLanguages` JSON NULL,
    `status` VARCHAR(191) NULL,
    `tagline` TEXT NULL,
    `imdbId` VARCHAR(191) NULL,
    `cast` JSON NULL,
    `crew` JSON NULL,
    `videos` JSON NULL,
    `seasons` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Movie_tmdbId_key`(`tmdbId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TvShow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tmdbId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `overview` TEXT NULL,
    `posterPath` VARCHAR(191) NULL,
    `backdropPath` VARCHAR(191) NULL,
    `firstAirDate` DATETIME(3) NULL,
    `voteAverage` DOUBLE NULL,
    `voteCount` INTEGER NULL,
    `genres` JSON NULL,
    `status` VARCHAR(191) NULL,
    `numberOfSeasons` INTEGER NULL,
    `numberOfEpisodes` INTEGER NULL,
    `originCountry` JSON NULL,
    `spokenLanguage` VARCHAR(191) NULL,
    `cast` JSON NULL,
    `crew` JSON NULL,
    `videos` JSON NULL,
    `seasons` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TvShow_tmdbId_key`(`tmdbId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SyncLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `tmdbId` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TmdbCache` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cacheKey` VARCHAR(512) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `query` TEXT NOT NULL,
    `payload` JSON NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 200,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TmdbCache_cacheKey_key`(`cacheKey`),
    INDEX `TmdbCache_path_idx`(`path`),
    INDEX `TmdbCache_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApiKey` ADD CONSTRAINT `ApiKey_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiRequestLog` ADD CONSTRAINT `ApiRequestLog_apiKeyId_fkey` FOREIGN KEY (`apiKeyId`) REFERENCES `ApiKey`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
