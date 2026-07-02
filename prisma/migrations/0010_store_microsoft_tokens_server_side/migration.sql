CREATE TABLE `MicrosoftAuthToken` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `accessTokenEncrypted` LONGTEXT NOT NULL,
  `refreshTokenEncrypted` LONGTEXT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `scopes` VARCHAR(512) NOT NULL,
  `lastError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MicrosoftAuthToken_userId_key`(`userId`),
  INDEX `MicrosoftAuthToken_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MicrosoftAuthToken`
  ADD CONSTRAINT `MicrosoftAuthToken_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
