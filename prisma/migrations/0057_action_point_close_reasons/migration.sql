ALTER TABLE `ActionPoint`
  ADD COLUMN `closedReason` VARCHAR(191) NULL,
  ADD COLUMN `closedReasonExplanation` TEXT NULL;

ALTER TABLE `ActionPointAssignment`
  ADD COLUMN `closedReason` VARCHAR(191) NULL,
  ADD COLUMN `closedReasonExplanation` TEXT NULL;
