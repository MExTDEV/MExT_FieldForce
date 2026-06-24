ALTER TABLE `Intervention`
  MODIFY `status` ENUM(
    'CONCEPT',
    'GEPLAND',
    'IN_UITVOERING',
    'WACHT_OP_VT_INPUT',
    'WACHT_OP_VT',
    'WACHT_OP_AKKOORD',
    'GEFINALISEERD',
    'AFGESLOTEN',
    'GESLOTEN',
    'GEANNULEERD'
  ) NOT NULL DEFAULT 'CONCEPT',
  ADD COLUMN `teamId` VARCHAR(191) NULL,
  ADD COLUMN `startTime` VARCHAR(191) NULL,
  ADD COLUMN `endTime` VARCHAR(191) NULL,
  ADD COLUMN `notifyRepresentative` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `finalizedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

ALTER TABLE `ActionPoint`
  MODIFY `status` ENUM(
    'OPEN',
    'NIEUW',
    'IN_UITVOERING',
    'AFGEROND',
    'BEHAALD',
    'NIET_BEHAALD',
    'GEANNULEERD'
  ) NOT NULL DEFAULT 'NIEUW';

ALTER TABLE `HelpRequest`
  ADD COLUMN `linkedInterventionId` VARCHAR(191) NULL;

ALTER TABLE `Approval`
  MODIFY `status` ENUM('GELEZEN_AKKOORD', 'GELEZEN_NIET_AKKOORD') NULL;

CREATE TABLE `TrainingDetail` (
  `id` VARCHAR(191) NOT NULL,
  `interventionId` VARCHAR(191) NOT NULL,
  `theme` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `desiredImprovement` TEXT NULL,
  `targetAudience` VARCHAR(191) NULL,
  `kpi` VARCHAR(191) NULL,
  `frameworkPhase` VARCHAR(191) NULL,
  `trainer` VARCHAR(191) NULL,
  `result` TEXT NULL,
  `conclusion` TEXT NULL,
  `followUpAction` TEXT NULL,
  `createIndividualActions` BOOLEAN NOT NULL DEFAULT false,
  `createGroupAction` BOOLEAN NOT NULL DEFAULT false,
  `actionDue` DATETIME(3) NULL,
  `sourceHelpRequestId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `TrainingDetail_interventionId_key` (`interventionId`),
  CONSTRAINT `TrainingDetail_interventionId_fkey`
    FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Intervention_teamId_idx` ON `Intervention`(`teamId`);
