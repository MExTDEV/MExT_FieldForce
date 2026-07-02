ALTER TABLE `User`
  ADD COLUMN `microsoftEmail` VARCHAR(191) NULL,
  ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

CREATE TABLE `UserLoginSession` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `requestKey` VARCHAR(191) NOT NULL,
  `loginAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `provider` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `ipAddress` VARCHAR(191) NULL,
  `userAgent` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `UserLoginSession_requestKey_key`(`requestKey`),
  INDEX `UserLoginSession_userId_loginAt_idx`(`userId`, `loginAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `UserLoginSession`
  ADD CONSTRAINT `UserLoginSession_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
