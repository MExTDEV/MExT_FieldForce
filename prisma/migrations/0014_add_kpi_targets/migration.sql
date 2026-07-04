ALTER TABLE `KpiDefinition`
  ADD COLUMN `targetValue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `minValue` DECIMAL(14, 2) NULL,
  ADD COLUMN `maxValue` DECIMAL(14, 2) NULL,
  ADD COLUMN `evaluationDirection` ENUM('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET') NOT NULL DEFAULT 'HIGHER_IS_BETTER';

CREATE TABLE `KpiTargetOverride` (
  `id` VARCHAR(191) NOT NULL,
  `kpiDefinitionId` VARCHAR(191) NOT NULL,
  `scope` ENUM('COUNTRY', 'TEAM', 'USER') NOT NULL,
  `scopeKey` VARCHAR(191) NOT NULL,
  `country` ENUM('BE', 'NL', 'DE') NULL,
  `teamId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `targetValue` DECIMAL(14, 2) NOT NULL,
  `minValue` DECIMAL(14, 2) NULL,
  `maxValue` DECIMAL(14, 2) NULL,
  `evaluationDirection` ENUM('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `KpiTargetOverride_kpiDefinitionId_scopeKey_key`(`kpiDefinitionId`, `scopeKey`),
  INDEX `KpiTargetOverride_country_idx`(`country`),
  INDEX `KpiTargetOverride_teamId_idx`(`teamId`),
  INDEX `KpiTargetOverride_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KpiTargetOverride`
  ADD CONSTRAINT `KpiTargetOverride_kpiDefinitionId_fkey` FOREIGN KEY (`kpiDefinitionId`) REFERENCES `KpiDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `KpiTargetOverride_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `KpiTargetOverride_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
