ALTER TABLE `User`
  ADD COLUMN `profilePhotoStorageKey` VARCHAR(191) NULL,
  ADD COLUMN `profilePhotoMimeType` VARCHAR(191) NULL,
  ADD COLUMN `profilePhotoHash` VARCHAR(191) NULL,
  ADD COLUMN `profilePhotoSyncedAt` DATETIME(3) NULL,
  ADD COLUMN `profilePhotoSyncStatus` ENUM('SYNCED', 'NO_PHOTO', 'SKIPPED', 'ERROR') NULL,
  ADD COLUMN `profilePhotoSyncError` TEXT NULL;

CREATE INDEX `User_profilePhotoSyncStatus_idx` ON `User`(`profilePhotoSyncStatus`);

CREATE TABLE `ProfilePhotoSyncRun` (
  `id` VARCHAR(191) NOT NULL,
  `trigger` ENUM('NIGHTLY', 'MANUAL') NOT NULL,
  `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL_ERROR', 'ERROR', 'SKIPPED') NOT NULL DEFAULT 'QUEUED',
  `startedByUserId` VARCHAR(191) NULL,
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `checkedUsers` INTEGER NOT NULL DEFAULT 0,
  `updatedPhotos` INTEGER NOT NULL DEFAULT 0,
  `unchangedPhotos` INTEGER NOT NULL DEFAULT 0,
  `noPhotoUsers` INTEGER NOT NULL DEFAULT 0,
  `skippedUsers` INTEGER NOT NULL DEFAULT 0,
  `errorUsers` INTEGER NOT NULL DEFAULT 0,
  `errorMessage` TEXT NULL,
  `userErrorsJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ProfilePhotoSyncRun_status_createdAt_idx` ON `ProfilePhotoSyncRun`(`status`, `createdAt`);
CREATE INDEX `ProfilePhotoSyncRun_trigger_createdAt_idx` ON `ProfilePhotoSyncRun`(`trigger`, `createdAt`);
CREATE INDEX `ProfilePhotoSyncRun_startedByUserId_idx` ON `ProfilePhotoSyncRun`(`startedByUserId`);
