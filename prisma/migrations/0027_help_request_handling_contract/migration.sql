ALTER TABLE `HelpRequest`
  MODIFY `status` ENUM(
    'NIEUW',
    'OPEN',
    'IN_BEHANDELING',
    'VERVOLGACTIE_GEPLAND',
    'BEGELEIDING',
    'CONTACTMOMENT',
    'RETRAINING',
    'SALESTRAINING',
    'GESLOTEN',
    'INGETROKKEN',
    'AFGESLOTEN',
    'GEANNULEERD'
  ) NOT NULL DEFAULT 'NIEUW';

ALTER TABLE `HelpRequest`
  ADD COLUMN `responsibleUserId` VARCHAR(191) NULL,
  ADD COLUMN `descriptionHtml` LONGTEXT NULL,
  ADD COLUMN `descriptionText` TEXT NULL,
  ADD COLUMN `firstHandledAt` DATETIME(3) NULL,
  ADD COLUMN `firstHandledByUserId` VARCHAR(191) NULL,
  ADD COLUMN `withdrawnAt` DATETIME(3) NULL,
  ADD COLUMN `withdrawnByUserId` VARCHAR(191) NULL;

UPDATE `HelpRequest`
SET
  `descriptionText` = COALESCE(NULLIF(`explanation`, ''), NULLIF(`difficulty`, ''), NULLIF(`desiredResult`, ''), `subject`),
  `descriptionHtml` = CONCAT('<p>', COALESCE(NULLIF(`explanation`, ''), NULLIF(`difficulty`, ''), NULLIF(`desiredResult`, ''), `subject`), '</p>')
WHERE `descriptionHtml` IS NULL;

CREATE TABLE `HelpRequestAnswer` (
  `id` VARCHAR(191) NOT NULL,
  `helpRequestId` VARCHAR(191) NOT NULL,
  `authorId` VARCHAR(191) NOT NULL,
  `bodyHtml` LONGTEXT NOT NULL,
  `bodyText` TEXT NOT NULL,
  `closesRequest` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `HelpRequestAnswer_helpRequestId_createdAt_idx`(`helpRequestId`, `createdAt`),
  INDEX `HelpRequestAnswer_authorId_idx`(`authorId`),
  CONSTRAINT `HelpRequestAnswer_helpRequestId_fkey` FOREIGN KEY (`helpRequestId`) REFERENCES `HelpRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `HelpRequestAnswer_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX `HelpRequest_requesterId_idx` ON `HelpRequest`(`requesterId`);
CREATE INDEX `HelpRequest_responsibleUserId_idx` ON `HelpRequest`(`responsibleUserId`);
CREATE INDEX `HelpRequest_status_idx` ON `HelpRequest`(`status`);
CREATE INDEX `HelpRequest_representativeId_idx` ON `HelpRequest`(`representativeId`);
CREATE INDEX `HelpRequest_firstHandledAt_idx` ON `HelpRequest`(`firstHandledAt`);
CREATE INDEX `HelpRequest_createdAt_idx` ON `HelpRequest`(`createdAt`);

ALTER TABLE `HelpRequest`
  ADD CONSTRAINT `HelpRequest_responsibleUserId_fkey` FOREIGN KEY (`responsibleUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
