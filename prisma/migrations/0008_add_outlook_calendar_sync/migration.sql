ALTER TABLE `Intervention`
  ADD COLUMN `outlookEventId` VARCHAR(191) NULL,
  ADD COLUMN `outlookICalUId` VARCHAR(191) NULL,
  ADD COLUMN `outlookSyncStatus` ENUM('NOT_SYNCED', 'SYNCED', 'ERROR') NOT NULL DEFAULT 'NOT_SYNCED',
  ADD COLUMN `lastSyncedAt` DATETIME(3) NULL,
  ADD COLUMN `syncError` TEXT NULL;

CREATE INDEX `Intervention_outlookEventId_idx` ON `Intervention`(`outlookEventId`);
