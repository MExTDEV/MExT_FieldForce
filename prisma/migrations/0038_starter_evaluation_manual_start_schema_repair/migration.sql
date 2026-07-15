-- Repair drift for environments where 0034_starter_evaluations was applied
-- before manual-start audit columns were present on StarterEvaluation.
-- Existing evaluations keep nullable manual-start fields; no historical starter
-- is invented.

ALTER TABLE `StarterEvaluation`
  ADD COLUMN IF NOT EXISTS `manualStartedById` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `manualStartedAt` DATETIME(3) NULL;

CREATE INDEX IF NOT EXISTS `StarterEvaluation_manualStartedById_manualStartedAt_idx`
  ON `StarterEvaluation` (`manualStartedById`, `manualStartedAt`);

SET @constraint_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'StarterEvaluation'
    AND CONSTRAINT_NAME = 'StarterEvaluation_manualStartedById_fkey'
);
SET @statement := IF(
  @constraint_exists = 0,
  'ALTER TABLE `StarterEvaluation` ADD CONSTRAINT `StarterEvaluation_manualStartedById_fkey` FOREIGN KEY (`manualStartedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
