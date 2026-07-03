ALTER TABLE `UserLoginSession`
  ADD COLUMN `sessionId` VARCHAR(191) NULL,
  ADD COLUMN `logoutAt` DATETIME(3) NULL,
  ADD COLUMN `lastActivityAt` DATETIME(3) NULL,
  ADD COLUMN `expiresAt` DATETIME(3) NULL,
  ADD COLUMN `durationSeconds` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `browser` VARCHAR(191) NULL,
  ADD COLUMN `operatingSystem` VARCHAR(191) NULL,
  ADD COLUMN `deviceType` VARCHAR(191) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `UserLoginSession`
SET
  `sessionId` = `requestKey`,
  `lastActivityAt` = `loginAt`,
  `expiresAt` = DATE_ADD(`loginAt`, INTERVAL 30 DAY);

ALTER TABLE `UserLoginSession`
  MODIFY `sessionId` VARCHAR(191) NOT NULL,
  MODIFY `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  MODIFY `expiresAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `UserLoginSession_sessionId_key` ON `UserLoginSession`(`sessionId`);
CREATE INDEX `UserLoginSession_userId_provider_idx` ON `UserLoginSession`(`userId`, `provider`);
CREATE INDEX `UserLoginSession_userId_lastActivityAt_idx` ON `UserLoginSession`(`userId`, `lastActivityAt`);
