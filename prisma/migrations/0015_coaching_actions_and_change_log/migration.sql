CREATE TABLE `ActionDefinition` (
  `id` VARCHAR(191) NOT NULL, `title` VARCHAR(191) NOT NULL, `description` TEXT NOT NULL,
  `tipsAndTricks` LONGTEXT NOT NULL, `targetValue` DECIMAL(14,2) NULL,
  `priority` ENUM('LOW','NORMAL','HIGH') NOT NULL DEFAULT 'NORMAL',
  `scope` ENUM('GLOBAL','COUNTRY','TEAM','USER') NOT NULL DEFAULT 'GLOBAL', `scopeKey` VARCHAR(191) NOT NULL,
  `country` ENUM('BE','NL','DE') NULL, `teamId` VARCHAR(191) NULL, `userId` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true, `validFrom` DATETIME(3) NOT NULL, `validUntil` DATETIME(3) NULL,
  `deletedAt` DATETIME(3) NULL, `createdById` VARCHAR(191) NOT NULL, `updatedById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `ActionDefinition_scope_scopeKey_active_idx`(`scope`,`scopeKey`,`active`),
  INDEX `ActionDefinition_validFrom_validUntil_idx`(`validFrom`,`validUntil`), INDEX `ActionDefinition_country_idx`(`country`),
  INDEX `ActionDefinition_teamId_idx`(`teamId`), INDEX `ActionDefinition_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ActionTargetOverride` (
  `id` VARCHAR(191) NOT NULL, `actionDefinitionId` VARCHAR(191) NOT NULL,
  `scope` ENUM('GLOBAL','COUNTRY','TEAM','USER') NOT NULL, `scopeKey` VARCHAR(191) NOT NULL,
  `country` ENUM('BE','NL','DE') NULL, `teamId` VARCHAR(191) NULL, `userId` VARCHAR(191) NULL,
  `targetValue` DECIMAL(14,2) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `ActionTargetOverride_actionDefinitionId_scopeKey_key`(`actionDefinitionId`,`scopeKey`),
  INDEX `ActionTargetOverride_country_idx`(`country`), INDEX `ActionTargetOverride_teamId_idx`(`teamId`), INDEX `ActionTargetOverride_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CoachingAction` (
  `id` VARCHAR(191) NOT NULL, `interventionId` VARCHAR(191) NOT NULL, `actionDefinitionId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NOT NULL, `title` VARCHAR(191) NOT NULL, `description` TEXT NOT NULL, `tipsAndTricks` LONGTEXT NOT NULL,
  `targetValue` DECIMAL(14,2) NULL, `achievedScore` DECIMAL(14,2) NULL, `priority` ENUM('LOW','NORMAL','HIGH') NOT NULL,
  `isNew` BOOLEAN NOT NULL DEFAULT false, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `CoachingAction_interventionId_actionDefinitionId_key`(`interventionId`,`actionDefinitionId`), INDEX `CoachingAction_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CoachingChangeLog` (
  `id` VARCHAR(191) NOT NULL, `interventionId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
  `field` VARCHAR(191) NOT NULL, `oldValue` LONGTEXT NULL, `newValue` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `CoachingChangeLog_interventionId_createdAt_idx`(`interventionId`,`createdAt`), INDEX `CoachingChangeLog_userId_idx`(`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ActionDefinition`
  ADD CONSTRAINT `ActionDefinition_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ActionDefinition_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ActionDefinition_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ActionDefinition_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ActionTargetOverride`
  ADD CONSTRAINT `ActionTargetOverride_actionDefinitionId_fkey` FOREIGN KEY (`actionDefinitionId`) REFERENCES `ActionDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ActionTargetOverride_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ActionTargetOverride_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CoachingAction`
  ADD CONSTRAINT `CoachingAction_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CoachingAction_actionDefinitionId_fkey` FOREIGN KEY (`actionDefinitionId`) REFERENCES `ActionDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CoachingAction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CoachingChangeLog`
  ADD CONSTRAINT `CoachingChangeLog_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CoachingChangeLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
