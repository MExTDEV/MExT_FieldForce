-- Representative levels and peer-coaching foundation.
-- Existing representatives become Sales Executive; new representatives default to Starter.

ALTER TABLE `User`
  ADD COLUMN `representativeLevel` ENUM('STARTER', 'SALES_EXECUTIVE', 'PROFESSIONAL', 'EXPERT') NOT NULL DEFAULT 'STARTER';

CREATE TABLE `RepresentativeLevelHistory` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `oldValue` ENUM('STARTER', 'SALES_EXECUTIVE', 'PROFESSIONAL', 'EXPERT') NULL,
  `newValue` ENUM('STARTER', 'SALES_EXECUTIVE', 'PROFESSIONAL', 'EXPERT') NOT NULL,
  `changedById` VARCHAR(191) NULL,
  `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reason` TEXT NULL,
  `migrationKey` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `RepresentativeLevelHistory_migrationKey_key` (`migrationKey`),
  INDEX `RepresentativeLevelHistory_userId_changedAt_idx` (`userId`, `changedAt`),
  INDEX `RepresentativeLevelHistory_changedById_idx` (`changedById`),
  CONSTRAINT `RepresentativeLevelHistory_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE `User`
SET `representativeLevel` = 'SALES_EXECUTIVE'
WHERE `role` = 'REPRESENTATIVE';

INSERT INTO `RepresentativeLevelHistory` (
  `id`,
  `userId`,
  `oldValue`,
  `newValue`,
  `changedAt`,
  `migrationKey`
)
SELECT
  CONCAT('rep-level-0023-', `id`),
  `id`,
  NULL,
  'SALES_EXECUTIVE',
  CURRENT_TIMESTAMP(3),
  CONCAT('0023-existing-rep-', `id`)
FROM `User`
WHERE `role` = 'REPRESENTATIVE'
ON DUPLICATE KEY UPDATE `migrationKey` = `migrationKey`;

CREATE INDEX `User_role_representativeLevel_idx` ON `User` (`role`, `representativeLevel`);

ALTER TABLE `Intervention`
  ADD COLUMN `notifyCoachedRepresentative` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `notifyCoachedTeamLeaders` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `notifyExecutorTeamLeaders` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `notifyCoachedLeaderIntent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `notifyExecutorLeaderIntent` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `peerCoach` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `teamDeviation` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `countryDeviation` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `deviationReason` TEXT NULL,
  ADD COLUMN `deviationRecordedById` VARCHAR(191) NULL,
  ADD COLUMN `deviationRecordedAt` DATETIME(3) NULL,
  ADD COLUMN `actualStartedAt` DATETIME(3) NULL,
  ADD COLUMN `executionDeadlineAt` DATETIME(3) NULL,
  ADD COLUMN `approvalDeadlineAt` DATETIME(3) NULL,
  ADD COLUMN `finalApprovalDeadlineAt` DATETIME(3) NULL,
  ADD COLUMN `performerAccessExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `lateCompletion` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `lateCompletionReason` TEXT NULL,
  ADD COLUMN `administrativelyClosedAt` DATETIME(3) NULL,
  ADD COLUMN `administrativelyClosedById` VARCHAR(191) NULL,
  ADD COLUMN `administrativeCloseReason` TEXT NULL,
  ADD COLUMN `copiedFromInterventionId` VARCHAR(191) NULL,
  ADD COLUMN `historicAccessSettings` LONGTEXT NULL;

CREATE INDEX `Intervention_ownerId_peerCoach_idx` ON `Intervention` (`ownerId`, `peerCoach`);
CREATE INDEX `Intervention_executionDeadlineAt_idx` ON `Intervention` (`executionDeadlineAt`);
CREATE INDEX `Intervention_performerAccessExpiresAt_idx` ON `Intervention` (`performerAccessExpiresAt`);
CREATE INDEX `Intervention_copiedFromInterventionId_idx` ON `Intervention` (`copiedFromInterventionId`);

ALTER TABLE `CoachingAction`
  ADD COLUMN `reviewStatus` ENUM('PROPOSED', 'APPROVED', 'REJECTED', 'ACTIVE') NOT NULL DEFAULT 'PROPOSED',
  ADD COLUMN `originalTitle` TEXT NULL,
  ADD COLUMN `originalDescription` TEXT NULL,
  ADD COLUMN `originalTipsAndTricks` LONGTEXT NULL,
  ADD COLUMN `rejectionReason` TEXT NULL,
  ADD COLUMN `reviewComment` TEXT NULL,
  ADD COLUMN `reviewedById` VARCHAR(191) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `activatedAt` DATETIME(3) NULL;

CREATE INDEX `CoachingAction_reviewStatus_idx` ON `CoachingAction` (`reviewStatus`);
CREATE INDEX `CoachingAction_reviewedById_idx` ON `CoachingAction` (`reviewedById`);

CREATE TABLE `Holiday` (
  `id` VARCHAR(191) NOT NULL,
  `country` ENUM('BE', 'NL', 'DE') NOT NULL,
  `date` DATE NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdById` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Holiday_country_date_name_key` (`country`, `date`, `name`),
  INDEX `Holiday_country_date_active_idx` (`country`, `date`, `active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AppSetting` (
  `id` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `value` LONGTEXT NOT NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AppSetting_key_key` (`key`),
  INDEX `AppSetting_key_idx` (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `AppSetting` (`id`, `key`, `value`, `createdAt`, `updatedAt`)
VALUES ('setting-mail-test', 'MAIL_TEST', 'true', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `key` = `key`;

CREATE TABLE `NotificationDelivery` (
  `id` VARCHAR(191) NOT NULL,
  `eventKey` VARCHAR(191) NOT NULL,
  `recipientUserId` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `sourceModule` VARCHAR(191) NULL,
  `entityType` VARCHAR(191) NULL,
  `entityId` VARCHAR(191) NULL,
  `mailTestActive` BOOLEAN NOT NULL DEFAULT true,
  `originalTo` TEXT NULL,
  `originalCc` TEXT NULL,
  `originalBcc` TEXT NULL,
  `actualTo` TEXT NULL,
  `error` TEXT NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `NotificationDelivery_eventKey_recipientUserId_channel_key` (`eventKey`, `recipientUserId`, `channel`),
  INDEX `NotificationDelivery_recipientUserId_createdAt_idx` (`recipientUserId`, `createdAt`),
  INDEX `NotificationDelivery_entityType_entityId_idx` (`entityType`, `entityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
