ALTER TABLE `User` ADD COLUMN `representativeId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_representativeId_key` ON `User`(`representativeId`);
