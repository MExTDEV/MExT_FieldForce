-- Repair drift for environments where 0034_starter_evaluations was applied
-- before the question management audit/configuration columns were added to
-- schema.prisma. Existing records keep nullable audit fields; no historical
-- creator/updater is invented.

ALTER TABLE `StarterEvaluationQuestion`
  MODIFY COLUMN `answerType` ENUM('SHORT_TEXT','RICH_TEXT','BOOLEAN','NUMBER','PERCENTAGE','CURRENCY','SCORE','CHOICE','MULTI_CHOICE','DATE','SYSTEM','LINKED_CRITERION','ACTION_POINTS') NOT NULL,
  ADD COLUMN IF NOT EXISTS `optionsJson` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `createdById` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `updatedById` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `linkedCriterionType` ENUM('KPI','COAT_RACK','GENERAL_EVALUATION','PERSONALITY','GENERAL_COACHING_SCORE') NULL,
  ADD COLUMN IF NOT EXISTS `linkedCriterionId` VARCHAR(191) NULL;

ALTER TABLE `StarterEvaluationQuestionSnapshot`
  MODIFY COLUMN `answerType` ENUM('SHORT_TEXT','RICH_TEXT','BOOLEAN','NUMBER','PERCENTAGE','CURRENCY','SCORE','CHOICE','MULTI_CHOICE','DATE','SYSTEM','LINKED_CRITERION','ACTION_POINTS') NOT NULL,
  ADD COLUMN IF NOT EXISTS `optionsJson` LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS `linkedCriterionType` ENUM('KPI','COAT_RACK','GENERAL_EVALUATION','PERSONALITY','GENERAL_COACHING_SCORE') NULL,
  ADD COLUMN IF NOT EXISTS `linkedCriterionId` VARCHAR(191) NULL;

CREATE TABLE IF NOT EXISTS `StarterEvaluationQuestionScopeLink` (
  `id` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `scopeType` ENUM('GLOBAL','COUNTRY','TEAM','USER') NOT NULL,
  `scopeKey` VARCHAR(191) NOT NULL,
  `country` ENUM('BE','NL','DE') NULL,
  `teamId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdById` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SEQSL_question_scope_key` (`questionId`, `scopeType`, `scopeKey`),
  INDEX `SEQSL_scope_key_idx` (`scopeType`, `scopeKey`),
  INDEX `SEQSL_question_sort_idx` (`questionId`, `sortOrder`),
  INDEX `SEQSL_country_idx` (`country`),
  INDEX `SEQSL_team_idx` (`teamId`),
  INDEX `SEQSL_user_idx` (`userId`),
  CONSTRAINT `StarterEvaluationQuestionScopeLink_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `StarterEvaluationQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestionScopeLink_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestionScopeLink_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StarterEvaluationQuestionScopeLink`
  ADD COLUMN IF NOT EXISTS `createdById` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `updatedById` VARCHAR(191) NULL;

INSERT INTO `StarterEvaluationQuestionScopeLink` (
  `id`,
  `questionId`,
  `scopeType`,
  `scopeKey`,
  `country`,
  `teamId`,
  `userId`,
  `sortOrder`,
  `createdAt`,
  `updatedAt`
)
SELECT
  CONCAT('seqs_repair_', `question`.`id`),
  `question`.`id`,
  `question`.`scopeType`,
  `question`.`scopeKey`,
  `question`.`country`,
  `question`.`teamId`,
  `question`.`userId`,
  `question`.`sortOrder`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `StarterEvaluationQuestion` `question`
WHERE NOT EXISTS (
  SELECT 1
  FROM `StarterEvaluationQuestionScopeLink` `scopeLink`
  WHERE `scopeLink`.`questionId` = `question`.`id`
);

CREATE INDEX IF NOT EXISTS `SEQ_linkedCriterion_idx`
  ON `StarterEvaluationQuestion` (`linkedCriterionType`, `linkedCriterionId`);

CREATE INDEX IF NOT EXISTS `SEQS_section_sort_idx`
  ON `StarterEvaluationQuestionSnapshot` (`sectionSnapshotId`, `sortOrder`);

CREATE INDEX IF NOT EXISTS `SEQS_scope_idx`
  ON `StarterEvaluationQuestionSnapshot` (`appliedScopeType`, `appliedScopeKey`);

SET @constraint_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'StarterEvaluationQuestion'
    AND CONSTRAINT_NAME = 'StarterEvaluationQuestion_createdById_fkey'
);
SET @statement := IF(
  @constraint_exists = 0,
  'ALTER TABLE `StarterEvaluationQuestion` ADD CONSTRAINT `StarterEvaluationQuestion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'StarterEvaluationQuestion'
    AND CONSTRAINT_NAME = 'StarterEvaluationQuestion_updatedById_fkey'
);
SET @statement := IF(
  @constraint_exists = 0,
  'ALTER TABLE `StarterEvaluationQuestion` ADD CONSTRAINT `StarterEvaluationQuestion_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
