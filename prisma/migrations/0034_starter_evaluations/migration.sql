ALTER TABLE `User`
  ADD COLUMN IF NOT EXISTS `starterStartDate` DATE NULL;

ALTER TABLE `KpiDefinition`
  ADD COLUMN IF NOT EXISTS `include_in_starter_evaluations` BOOLEAN NOT NULL DEFAULT false;

INSERT INTO `Permission` (`id`, `key`, `label`, `group`, `description`, `createdAt`, `updatedAt`)
VALUES (
  'perm-0034-menu-coaching-starter-evaluations',
  'menu.coaching.starterEvaluations',
  'Tussentijdse evaluaties',
  'Coaching',
  'Menu-toegang tot Tussentijdse evaluaties.',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `group` = VALUES(`group`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('rp-0034-starter-eval-', `role_name`), `role_name`, permission_record.`id`, true
FROM (
  SELECT 'REPRESENTATIVE' AS `role_name`
  UNION SELECT 'SALES_LEADER'
  UNION SELECT 'SALES_MANAGER'
  UNION SELECT 'COUNTRY_MANAGER'
  UNION SELECT 'GROUP_MANAGER'
  UNION SELECT 'ADMIN'
  UNION SELECT 'SUPER_ADMIN'
) AS role_seed
JOIN `Permission` AS permission_record
  ON permission_record.`key` = 'menu.coaching.starterEvaluations'
ON DUPLICATE KEY UPDATE `enabled` = `RolePermission`.`enabled`;

CREATE TABLE IF NOT EXISTS `StarterEvaluationSection` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `titleNl` VARCHAR(191) NOT NULL,
  `titleFr` VARCHAR(191) NULL,
  `titleDe` VARCHAR(191) NULL,
  `descriptionNl` TEXT NULL,
  `descriptionFr` TEXT NULL,
  `descriptionDe` TEXT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `momentsJson` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StarterEvaluationSection_code_key` (`code`),
  INDEX `StarterEvaluationSection_active_sortOrder_idx` (`active`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StarterEvaluationQuestion` (
  `id` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `sectionId` VARCHAR(191) NOT NULL,
  `textNl` TEXT NOT NULL,
  `textFr` TEXT NULL,
  `textDe` TEXT NULL,
  `helpNl` TEXT NULL,
  `helpFr` TEXT NULL,
  `helpDe` TEXT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `required` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `answerType` ENUM('SHORT_TEXT','RICH_TEXT','BOOLEAN','NUMBER','PERCENTAGE','CURRENCY','SCORE','CHOICE','DATE','SYSTEM','LINKED_CRITERION','ACTION_POINTS') NOT NULL,
  `assignee` ENUM('REPRESENTATIVE','EVALUATOR','BOTH_SEPARATE','SYSTEM','SHARED_EVALUATOR') NOT NULL,
  `momentsJson` VARCHAR(255) NOT NULL,
  `scopeType` ENUM('GLOBAL','COUNTRY','TEAM','USER') NOT NULL DEFAULT 'GLOBAL',
  `scopeKey` VARCHAR(191) NOT NULL DEFAULT 'GLOBAL',
  `country` ENUM('BE','NL','DE') NULL,
  `teamId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `createdById` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `linkedCriterionType` ENUM('KPI','COAT_RACK','GENERAL_EVALUATION','PERSONALITY','GENERAL_COACHING_SCORE') NULL,
  `linkedCriterionId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StarterEvaluationQuestion_key_key` (`key`),
  INDEX `StarterEvaluationQuestion_sectionId_active_sortOrder_idx` (`sectionId`, `active`, `sortOrder`),
  INDEX `StarterEvaluationQuestion_scopeType_scopeKey_idx` (`scopeType`, `scopeKey`),
  INDEX `SEQ_linkedCriterion_idx` (`linkedCriterionType`, `linkedCriterionId`),
  CONSTRAINT `StarterEvaluationQuestion_sectionId_fkey` FOREIGN KEY (`sectionId`) REFERENCES `StarterEvaluationSection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestion_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestion_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StarterEvaluationQuestionScopeLink` (
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
  UNIQUE INDEX `StarterEvaluationQuestionScopeLink_questionId_scopeType_scopeKey_key` (`questionId`, `scopeType`, `scopeKey`),
  INDEX `StarterEvaluationQuestionScopeLink_scopeType_scopeKey_idx` (`scopeType`, `scopeKey`),
  INDEX `StarterEvaluationQuestionScopeLink_questionId_sortOrder_idx` (`questionId`, `sortOrder`),
  INDEX `StarterEvaluationQuestionScopeLink_country_idx` (`country`),
  INDEX `StarterEvaluationQuestionScopeLink_teamId_idx` (`teamId`),
  INDEX `StarterEvaluationQuestionScopeLink_userId_idx` (`userId`),
  CONSTRAINT `StarterEvaluationQuestionScopeLink_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `StarterEvaluationQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestionScopeLink_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestionScopeLink_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StarterEvaluation` (
  `id` VARCHAR(191) NOT NULL,
  `representativeId` VARCHAR(191) NOT NULL,
  `moment` ENUM('MONTH_1_5','MONTH_3','MONTH_5') NULL,
  `status` ENUM('DUE','PREPARATION','READY_FOR_CONVERSATION','IN_PROGRESS','WAITING_FOR_APPROVAL','NOT_AGREED','APPROVED','CANCELLED') NOT NULL DEFAULT 'DUE',
  `milestoneDate` DATE NOT NULL,
  `starterStartDateSnapshot` DATE NOT NULL,
  `manualStartedById` VARCHAR(191) NULL,
  `manualStartedAt` DATETIME(3) NULL,
  `plannedConversationDate` DATE NULL,
  `plannedStartTime` VARCHAR(5) NULL,
  `plannedEndTime` VARCHAR(5) NULL,
  `plannedLocation` VARCHAR(191) NULL,
  `planningNote` TEXT NULL,
  `leaderId` VARCHAR(191) NULL,
  `countryManagerId` VARCHAR(191) NULL,
  `evaluatorAnswersRevealedAt` DATETIME(3) NULL,
  `preparationOpenedAt` DATETIME(3) NULL,
  `milestoneNotifiedAt` DATETIME(3) NULL,
  `sentForApprovalAt` DATETIME(3) NULL,
  `sentForApprovalById` VARCHAR(191) NULL,
  `approvalComment` TEXT NULL,
  `approvedAt` DATETIME(3) NULL,
  `approvedById` VARCHAR(191) NULL,
  `notAgreedAt` DATETIME(3) NULL,
  `notAgreedReason` TEXT NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledById` VARCHAR(191) NULL,
  `cancellationReason` TEXT NULL,
  `finalDocumentStorageKey` VARCHAR(191) NULL,
  `finalDocumentHash` VARCHAR(191) NULL,
  `kpiSnapshotJson` LONGTEXT NULL,
  `autoDataSnapshotJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StarterEvaluation_representativeId_moment_key` (`representativeId`, `moment`),
  INDEX `StarterEvaluation_representativeId_milestoneDate_status_idx` (`representativeId`, `milestoneDate`, `status`),
  INDEX `StarterEvaluation_manualStartedById_manualStartedAt_idx` (`manualStartedById`, `manualStartedAt`),
  INDEX `StarterEvaluation_status_milestoneDate_idx` (`status`, `milestoneDate`),
  INDEX `StarterEvaluation_leaderId_status_idx` (`leaderId`, `status`),
  INDEX `StarterEvaluation_countryManagerId_status_idx` (`countryManagerId`, `status`),
  CONSTRAINT `StarterEvaluation_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluation_leaderId_fkey` FOREIGN KEY (`leaderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluation_countryManagerId_fkey` FOREIGN KEY (`countryManagerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluation_sentForApprovalById_fkey` FOREIGN KEY (`sentForApprovalById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluation_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluation_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluation_manualStartedById_fkey` FOREIGN KEY (`manualStartedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StarterEvaluationSectionSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `evaluationId` VARCHAR(191) NOT NULL,
  `sourceSectionId` VARCHAR(191) NULL,
  `code` VARCHAR(191) NOT NULL,
  `titleNl` VARCHAR(191) NOT NULL,
  `titleFr` VARCHAR(191) NULL,
  `titleDe` VARCHAR(191) NULL,
  `descriptionNl` TEXT NULL,
  `descriptionFr` TEXT NULL,
  `descriptionDe` TEXT NULL,
  `sortOrder` INTEGER NOT NULL,
  `momentsJson` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StarterEvaluationSectionSnapshot_evaluationId_code_key` (`evaluationId`, `code`),
  INDEX `StarterEvaluationSectionSnapshot_evaluationId_sortOrder_idx` (`evaluationId`, `sortOrder`),
  CONSTRAINT `StarterEvaluationSectionSnapshot_evaluationId_fkey` FOREIGN KEY (`evaluationId`) REFERENCES `StarterEvaluation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationSectionSnapshot_sourceSectionId_fkey` FOREIGN KEY (`sourceSectionId`) REFERENCES `StarterEvaluationSection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StarterEvaluationQuestionSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `evaluationId` VARCHAR(191) NOT NULL,
  `sectionSnapshotId` VARCHAR(191) NOT NULL,
  `sourceQuestionId` VARCHAR(191) NULL,
  `key` VARCHAR(191) NOT NULL,
  `textNl` TEXT NOT NULL,
  `textFr` TEXT NULL,
  `textDe` TEXT NULL,
  `helpNl` TEXT NULL,
  `helpFr` TEXT NULL,
  `helpDe` TEXT NULL,
  `sortOrder` INTEGER NOT NULL,
  `required` BOOLEAN NOT NULL,
  `answerType` ENUM('SHORT_TEXT','RICH_TEXT','BOOLEAN','NUMBER','PERCENTAGE','CURRENCY','SCORE','CHOICE','DATE','SYSTEM','LINKED_CRITERION','ACTION_POINTS') NOT NULL,
  `assignee` ENUM('REPRESENTATIVE','EVALUATOR','BOTH_SEPARATE','SYSTEM','SHARED_EVALUATOR') NOT NULL,
  `momentsJson` VARCHAR(255) NOT NULL,
  `appliedScopeType` ENUM('GLOBAL','COUNTRY','TEAM','USER') NOT NULL,
  `appliedScopeKey` VARCHAR(191) NOT NULL,
  `linkedCriterionType` ENUM('KPI','COAT_RACK','GENERAL_EVALUATION','PERSONALITY','GENERAL_COACHING_SCORE') NULL,
  `linkedCriterionId` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StarterEvaluationQuestionSnapshot_evaluationId_key_key` (`evaluationId`, `key`),
  INDEX `SEQS_section_sort_idx` (`sectionSnapshotId`, `sortOrder`),
  INDEX `SEQS_scope_idx` (`appliedScopeType`, `appliedScopeKey`),
  CONSTRAINT `StarterEvaluationQuestionSnapshot_evaluationId_fkey` FOREIGN KEY (`evaluationId`) REFERENCES `StarterEvaluation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestionSnapshot_sectionSnapshotId_fkey` FOREIGN KEY (`sectionSnapshotId`) REFERENCES `StarterEvaluationSectionSnapshot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationQuestionSnapshot_sourceQuestionId_fkey` FOREIGN KEY (`sourceQuestionId`) REFERENCES `StarterEvaluationQuestion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StarterEvaluationAnswer` (
  `id` VARCHAR(191) NOT NULL,
  `evaluationId` VARCHAR(191) NOT NULL,
  `questionSnapshotId` VARCHAR(191) NOT NULL,
  `role` ENUM('REPRESENTATIVE','EVALUATOR','SYSTEM') NOT NULL,
  `valueJson` LONGTEXT NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StarterEvaluationAnswer_questionSnapshotId_role_key` (`questionSnapshotId`, `role`),
  INDEX `StarterEvaluationAnswer_evaluationId_role_idx` (`evaluationId`, `role`),
  CONSTRAINT `StarterEvaluationAnswer_evaluationId_fkey` FOREIGN KEY (`evaluationId`) REFERENCES `StarterEvaluation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationAnswer_questionSnapshotId_fkey` FOREIGN KEY (`questionSnapshotId`) REFERENCES `StarterEvaluationQuestionSnapshot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationAnswer_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StarterEvaluationDraftActionPoint` (
  `id` VARCHAR(191) NOT NULL,
  `evaluationId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `descriptionHtml` LONGTEXT NULL,
  `type` ENUM('KPI','VAARDIGHEID','GEDRAG') NOT NULL DEFAULT 'VAARDIGHEID',
  `targetValue` DECIMAL(14, 2) NULL,
  `startDate` DATE NULL,
  `dueDate` DATE NULL,
  `ownerId` VARCHAR(191) NULL,
  `createdActionPointId` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `StarterEvaluationDraftActionPoint_evaluationId_sortOrder_idx` (`evaluationId`, `sortOrder`),
  INDEX `StarterEvaluationDraftActionPoint_createdActionPointId_idx` (`createdActionPointId`),
  CONSTRAINT `StarterEvaluationDraftActionPoint_evaluationId_fkey` FOREIGN KEY (`evaluationId`) REFERENCES `StarterEvaluation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationDraftActionPoint_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `StarterEvaluationDraftActionPoint_createdActionPointId_fkey` FOREIGN KEY (`createdActionPointId`) REFERENCES `ActionPoint`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
