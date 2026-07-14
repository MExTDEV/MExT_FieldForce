ALTER TABLE `Approval`
  ADD COLUMN `reflectionKpiHtml` LONGTEXT NULL,
  ADD COLUMN `reflectionLearningHtml` LONGTEXT NULL,
  ADD COLUMN `reflectionGoalHtml` LONGTEXT NULL,
  ADD COLUMN `reflectionCompletedAt` DATETIME(3) NULL,
  ADD COLUMN `reflectionCompletedByUserId` VARCHAR(191) NULL;

CREATE INDEX `Approval_representativeId_status_idx` ON `Approval`(`representativeId`, `status`);
CREATE INDEX `Approval_reflectionCompletedByUserId_idx` ON `Approval`(`reflectionCompletedByUserId`);
