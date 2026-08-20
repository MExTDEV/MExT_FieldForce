-- Keep the close lifecycle on coaching-linked actions as well as standalone action points.
ALTER TABLE `CoachingAction`
  ADD COLUMN `status` ENUM('OPEN', 'NIEUW', 'IN_UITVOERING', 'AFGEROND', 'BEHAALD', 'NIET_BEHAALD', 'GEANNULEERD') NOT NULL DEFAULT 'OPEN',
  ADD COLUMN `closedAt` DATETIME(3) NULL,
  ADD COLUMN `closedByUserId` VARCHAR(191) NULL,
  ADD COLUMN `closedReason` VARCHAR(191) NULL,
  ADD COLUMN `closedReasonExplanation` TEXT NULL;

CREATE INDEX `CoachingAction_status_closedAt_idx` ON `CoachingAction`(`status`, `closedAt`);
CREATE INDEX `CoachingAction_closedByUserId_idx` ON `CoachingAction`(`closedByUserId`);

ALTER TABLE `CoachingAction`
  ADD CONSTRAINT `CoachingAction_closedByUserId_fkey`
  FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
