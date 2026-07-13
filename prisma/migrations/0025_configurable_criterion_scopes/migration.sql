-- Configurable criterion scopes and immutable coaching snapshots.
-- Existing content remains in its current source tables; this migration adds
-- a generic scope-link layer and snapshots for future coachings.

CREATE TABLE IF NOT EXISTS `ConfigurableCriterion` (
  `id` VARCHAR(191) NOT NULL,
  `type` ENUM('KPI', 'COAT_RACK', 'GENERAL_EVALUATION', 'PERSONALITY', 'GENERAL_COACHING_SCORE') NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `section` VARCHAR(191) NULL,
  `answerType` VARCHAR(191) NOT NULL DEFAULT 'SCORE_0_5',
  `scoreType` VARCHAR(191) NOT NULL DEFAULT 'SCORE',
  `minScore` INTEGER NOT NULL DEFAULT 0,
  `maxScore` INTEGER NOT NULL DEFAULT 5,
  `weight` DECIMAL(8, 2) NULL,
  `targetValue` DECIMAL(14, 2) NULL,
  `required` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdById` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ConfigurableCriterion_code_key` (`code`),
  INDEX `ConfigurableCriterion_type_active_idx` (`type`, `active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CriterionScopeLink` (
  `id` VARCHAR(191) NOT NULL,
  `criterionType` ENUM('KPI', 'COAT_RACK', 'GENERAL_EVALUATION', 'PERSONALITY', 'GENERAL_COACHING_SCORE') NOT NULL,
  `criterionKey` VARCHAR(191) NOT NULL,
  `kpiDefinitionId` VARCHAR(191) NULL,
  `coachingCriterionId` VARCHAR(191) NULL,
  `configurableCriterionId` VARCHAR(191) NULL,
  `scopeType` ENUM('GLOBAL', 'COUNTRY', 'TEAM', 'USER') NOT NULL,
  `scopeKey` VARCHAR(191) NOT NULL,
  `country` ENUM('BE', 'NL', 'DE') NULL,
  `teamId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdById` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CriterionScopeLink_criterionKey_scopeType_scopeKey_key` (`criterionKey`, `scopeType`, `scopeKey`),
  INDEX `CriterionScopeLink_criterionType_idx` (`criterionType`),
  INDEX `CriterionScopeLink_scopeType_scopeKey_idx` (`scopeType`, `scopeKey`),
  INDEX `CriterionScopeLink_kpiDefinitionId_idx` (`kpiDefinitionId`),
  INDEX `CriterionScopeLink_coachingCriterionId_idx` (`coachingCriterionId`),
  INDEX `CriterionScopeLink_configurableCriterionId_idx` (`configurableCriterionId`),
  INDEX `CriterionScopeLink_country_idx` (`country`),
  INDEX `CriterionScopeLink_teamId_idx` (`teamId`),
  INDEX `CriterionScopeLink_userId_idx` (`userId`),
  CONSTRAINT `CriterionScopeLink_kpiDefinitionId_fkey` FOREIGN KEY (`kpiDefinitionId`) REFERENCES `KpiDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CriterionScopeLink_coachingCriterionId_fkey` FOREIGN KEY (`coachingCriterionId`) REFERENCES `CoachingCriterion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CriterionScopeLink_configurableCriterionId_fkey` FOREIGN KEY (`configurableCriterionId`) REFERENCES `ConfigurableCriterion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CriterionScopeLink_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CriterionScopeLink_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CoachingCriterionSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `interventionId` VARCHAR(191) NOT NULL,
  `criterionType` ENUM('KPI', 'COAT_RACK', 'GENERAL_EVALUATION', 'PERSONALITY', 'GENERAL_COACHING_SCORE') NOT NULL,
  `sourceCriterionId` VARCHAR(191) NOT NULL,
  `sourceCriterionKey` VARCHAR(191) NOT NULL,
  `sourceScopeLinkId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `focusName` VARCHAR(191) NULL,
  `section` VARCHAR(191) NULL,
  `answerType` VARCHAR(191) NOT NULL,
  `scoreType` VARCHAR(191) NOT NULL,
  `minScore` INTEGER NULL,
  `maxScore` INTEGER NULL,
  `weight` DECIMAL(8, 2) NULL,
  `targetValue` DECIMAL(14, 2) NULL,
  `required` BOOLEAN NOT NULL DEFAULT false,
  `appliedScopeType` ENUM('GLOBAL', 'COUNTRY', 'TEAM', 'USER') NOT NULL,
  `appliedScopeKey` VARCHAR(191) NOT NULL,
  `appliedScopeLabel` VARCHAR(191) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `snapshotVersion` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CCSnapshot_intervention_type_source_key` (`interventionId`, `criterionType`, `sourceCriterionId`),
  INDEX `CCSnapshot_intervention_type_idx` (`interventionId`, `criterionType`),
  INDEX `CCSnapshot_source_key_idx` (`sourceCriterionKey`),
  INDEX `CCSnapshot_scope_idx` (`appliedScopeType`, `appliedScopeKey`),
  CONSTRAINT `CCSnapshot_intervention_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Score`
  ADD COLUMN `criterionSnapshotId` VARCHAR(191) NULL,
  ADD INDEX `Score_criterionSnapshotId_idx` (`criterionSnapshotId`),
  ADD CONSTRAINT `Score_criterionSnapshotId_fkey` FOREIGN KEY (`criterionSnapshotId`) REFERENCES `CoachingCriterionSnapshot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `ConfigurableCriterion` (`id`, `type`, `code`, `title`, `section`, `createdAt`, `updatedAt`) VALUES
  ('cfg-general-stiptheid', 'GENERAL_EVALUATION', 'GENERAL_STIPTHEID', 'Stiptheid', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-vertrekuur', 'GENERAL_EVALUATION', 'GENERAL_VERTREKUUR', 'Vertrekuur', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-demokoffer', 'GENERAL_EVALUATION', 'GENERAL_DEMOKOFFER', 'Demokoffer', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-draagtas', 'GENERAL_EVALUATION', 'GENERAL_DRAAGTAS_MET_KOFFERPRODUCTEN', 'Draagtas met kofferproducten', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-netheid-wagen', 'GENERAL_EVALUATION', 'GENERAL_NETHEID_WAGEN', 'Netheid wagen', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-stockbeheer', 'GENERAL_EVALUATION', 'GENERAL_STOCKBEHEER', 'Stockbeheer', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-voorbereiding', 'GENERAL_EVALUATION', 'GENERAL_VOORBEREIDING', 'Voorbereiding', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-administratie', 'GENERAL_EVALUATION', 'GENERAL_ADMINISTRATIE', 'Administratie', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-tempo', 'GENERAL_EVALUATION', 'GENERAL_TEMPO', 'Tempo', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-general-gebruik-laptop', 'GENERAL_EVALUATION', 'GENERAL_GEBRUIK_LAPTOP', 'Gebruik laptop', 'Dossier:Algemeen', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-personality-uitstraling', 'PERSONALITY', 'PERSONALITY_UITSTRALING', 'Uitstraling', 'Dossier:Persoonlijkheid', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-personality-zelfzekerheid', 'PERSONALITY', 'PERSONALITY_ZELFZEKERHEID', 'Zelfzekerheid', 'Dossier:Persoonlijkheid', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-personality-leiding', 'PERSONALITY', 'PERSONALITY_LEIDING_IN_GESPREK', 'Leiding in gesprek', 'Dossier:Persoonlijkheid', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-personality-verstaanbaarheid', 'PERSONALITY', 'PERSONALITY_VERSTAANBAARHEID', 'Verstaanbaarheid', 'Dossier:Persoonlijkheid', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-personality-overtuigend', 'PERSONALITY', 'PERSONALITY_OVERTUIGEND', 'Overtuigend', 'Dossier:Persoonlijkheid', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-personality-respect', 'PERSONALITY', 'PERSONALITY_RESPECT', 'Respect', 'Dossier:Persoonlijkheid', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('cfg-personality-verzorging', 'PERSONALITY', 'PERSONALITY_PERSOONLIJKE_VERZORGING', 'Persoonlijke verzorging', 'Dossier:Persoonlijkheid', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `section` = VALUES(`section`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `CriterionScopeLink` (`id`, `criterionType`, `criterionKey`, `configurableCriterionId`, `scopeType`, `scopeKey`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('scope-', `code`),
  `type`,
  CONCAT(`type`, ':', `id`),
  `id`,
  'GLOBAL',
  'GLOBAL',
  CASE `code`
    WHEN 'GENERAL_STIPTHEID' THEN 1
    WHEN 'GENERAL_VERTREKUUR' THEN 2
    WHEN 'GENERAL_DEMOKOFFER' THEN 3
    WHEN 'GENERAL_DRAAGTAS_MET_KOFFERPRODUCTEN' THEN 4
    WHEN 'GENERAL_NETHEID_WAGEN' THEN 5
    WHEN 'GENERAL_STOCKBEHEER' THEN 6
    WHEN 'GENERAL_VOORBEREIDING' THEN 7
    WHEN 'GENERAL_ADMINISTRATIE' THEN 8
    WHEN 'GENERAL_TEMPO' THEN 9
    WHEN 'GENERAL_GEBRUIK_LAPTOP' THEN 10
    WHEN 'PERSONALITY_UITSTRALING' THEN 1
    WHEN 'PERSONALITY_ZELFZEKERHEID' THEN 2
    WHEN 'PERSONALITY_LEIDING_IN_GESPREK' THEN 3
    WHEN 'PERSONALITY_VERSTAANBAARHEID' THEN 4
    WHEN 'PERSONALITY_OVERTUIGEND' THEN 5
    WHEN 'PERSONALITY_RESPECT' THEN 6
    WHEN 'PERSONALITY_PERSOONLIJKE_VERZORGING' THEN 7
    ELSE 0
  END,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `ConfigurableCriterion`
WHERE `type` IN ('GENERAL_EVALUATION', 'PERSONALITY', 'GENERAL_COACHING_SCORE')
ON DUPLICATE KEY UPDATE
  `sortOrder` = VALUES(`sortOrder`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `CriterionScopeLink` (`id`, `criterionType`, `criterionKey`, `kpiDefinitionId`, `scopeType`, `scopeKey`, `country`, `teamId`, `userId`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('scope-kpi-', `id`),
  'KPI',
  CONCAT('KPI:', `id`),
  `id`,
  CASE
    WHEN `target_user_id` IS NOT NULL THEN 'USER'
    WHEN `target_team_id` IS NOT NULL THEN 'TEAM'
    WHEN `country` IS NOT NULL THEN 'COUNTRY'
    ELSE 'GLOBAL'
  END,
  CASE
    WHEN `target_user_id` IS NOT NULL THEN CONCAT('USER:', `target_user_id`)
    WHEN `target_team_id` IS NOT NULL THEN CONCAT('TEAM:', `target_team_id`)
    WHEN `country` IS NOT NULL THEN CONCAT('COUNTRY:', `country`)
    ELSE 'GLOBAL'
  END,
  `country`,
  `target_team_id`,
  `target_user_id`,
  `sort_order`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `KpiDefinition`
ON DUPLICATE KEY UPDATE
  `sortOrder` = VALUES(`sortOrder`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `CriterionScopeLink` (`id`, `criterionType`, `criterionKey`, `coachingCriterionId`, `scopeType`, `scopeKey`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('scope-coatrack-', criterion.`id`),
  'COAT_RACK',
  CONCAT('COAT_RACK:', criterion.`id`),
  criterion.`id`,
  'GLOBAL',
  'GLOBAL',
  criterion.`sortOrder`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `CoachingCriterion` criterion
ON DUPLICATE KEY UPDATE
  `sortOrder` = VALUES(`sortOrder`),
  `updatedAt` = CURRENT_TIMESTAMP(3);
