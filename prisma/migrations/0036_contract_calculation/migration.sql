CREATE TABLE `ContractModelVersion` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','ACTIVE','INACTIVE') NOT NULL DEFAULT 'DRAFT',
  `sourceFileName` VARCHAR(191) NULL,
  `sourceFileSha256` VARCHAR(191) NOT NULL,
  `sourceWorkbookVersion` VARCHAR(191) NULL,
  `calculationEngineVersion` VARCHAR(191) NOT NULL,
  `notes` TEXT NULL,
  `activatedAt` DATETIME(3) NULL,
  `activatedByUserId` VARCHAR(191) NULL,
  `importedByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContractModelVersion_sourceFileSha256_key` (`sourceFileSha256`),
  INDEX `ContractModelVersion_status_idx` (`status`),
  INDEX `ContractModelVersion_code_idx` (`code`),
  INDEX `ContractModelVersion_activatedByUserId_idx` (`activatedByUserId`),
  INDEX `ContractModelVersion_importedByUserId_idx` (`importedByUserId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractArticle` (
  `id` VARCHAR(191) NOT NULL,
  `articleNumber` VARCHAR(191) NOT NULL,
  `stemNumber` VARCHAR(191) NOT NULL,
  `descriptionNl` TEXT NOT NULL,
  `descriptionFr` TEXT NOT NULL,
  `descriptionDe` TEXT NOT NULL,
  `unitPrice` DECIMAL(14,4) NOT NULL,
  `unitCost` DECIMAL(14,4) NOT NULL,
  `unit` VARCHAR(191) NOT NULL DEFAULT 'stuk',
  `vatRate` DECIMAL(5,2) NOT NULL DEFAULT 21.00,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `externalSource` VARCHAR(191) NULL,
  `externalId` VARCHAR(191) NULL,
  `lastSyncedAt` DATETIME(3) NULL,
  `sourceModelVersionId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContractArticle_articleNumber_key` (`articleNumber`),
  INDEX `ContractArticle_stemNumber_idx` (`stemNumber`),
  INDEX `ContractArticle_active_idx` (`active`),
  INDEX `ContractArticle_sourceModelVersionId_idx` (`sourceModelVersionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractCustomer` (
  `id` VARCHAR(191) NOT NULL,
  `companyName` VARCHAR(191) NOT NULL,
  `contactName` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `address` TEXT NULL,
  `street` VARCHAR(191) NULL,
  `houseNumber` VARCHAR(191) NULL,
  `postalCode` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `countryCode` ENUM('BE','NL','DE') NOT NULL,
  `vatNumber` VARCHAR(191) NULL,
  `preferredLanguage` ENUM('nl','fr','de') NOT NULL DEFAULT 'nl',
  `ownerUserId` VARCHAR(191) NOT NULL,
  `teamIdSnapshot` VARCHAR(191) NULL,
  `countrySnapshot` ENUM('BE','NL','DE') NOT NULL,
  `externalSource` VARCHAR(191) NULL,
  `externalId` VARCHAR(191) NULL,
  `lastSyncedAt` DATETIME(3) NULL,
  `isDemo` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ContractCustomer_ownerUserId_idx` (`ownerUserId`),
  INDEX `ContractCustomer_teamIdSnapshot_idx` (`teamIdSnapshot`),
  INDEX `ContractCustomer_countrySnapshot_idx` (`countrySnapshot`),
  INDEX `ContractCustomer_companyName_idx` (`companyName`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractTermRule` (
  `id` VARCHAR(191) NOT NULL,
  `modelVersionId` VARCHAR(191) NOT NULL,
  `durationYears` INTEGER NOT NULL,
  `discountPercentage` DECIMAL(6,2) NOT NULL,
  `priceMultiplier` DECIMAL(8,4) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContractTermRule_modelVersionId_durationYears_key` (`modelVersionId`, `durationYears`),
  INDEX `ContractTermRule_active_sortOrder_idx` (`active`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractCalculation` (
  `id` VARCHAR(191) NOT NULL,
  `calculationNumber` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` ENUM('DRAFT','SIGNED') NOT NULL DEFAULT 'DRAFT',
  `customerId` VARCHAR(191) NOT NULL,
  `ownerUserId` VARCHAR(191) NOT NULL,
  `teamIdSnapshot` VARCHAR(191) NULL,
  `countrySnapshot` ENUM('BE','NL','DE') NOT NULL,
  `customerLanguage` ENUM('nl','fr','de') NOT NULL DEFAULT 'nl',
  `modelVersionId` VARCHAR(191) NOT NULL,
  `durationYears` INTEGER NOT NULL,
  `discountPercentageSnapshot` DECIMAL(6,2) NOT NULL,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `discountAmount` DECIMAL(14,2) NOT NULL,
  `annualPrice` DECIMAL(14,2) NOT NULL,
  `totalCost` DECIMAL(14,2) NOT NULL,
  `marginAmount` DECIMAL(14,2) NOT NULL,
  `marginPercentage` DECIMAL(8,2) NOT NULL,
  `signedByName` VARCHAR(191) NULL,
  `signedAt` DATETIME(3) NULL,
  `signedPlace` VARCHAR(191) NULL,
  `signatureData` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContractCalculation_calculationNumber_key` (`calculationNumber`),
  INDEX `ContractCalculation_customerId_idx` (`customerId`),
  INDEX `ContractCalculation_ownerUserId_idx` (`ownerUserId`),
  INDEX `ContractCalculation_teamIdSnapshot_idx` (`teamIdSnapshot`),
  INDEX `ContractCalculation_countrySnapshot_idx` (`countrySnapshot`),
  INDEX `ContractCalculation_status_idx` (`status`),
  INDEX `ContractCalculation_modelVersionId_idx` (`modelVersionId`),
  INDEX `ContractCalculation_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractCalculationLine` (
  `id` VARCHAR(191) NOT NULL,
  `calculationId` VARCHAR(191) NOT NULL,
  `articleId` VARCHAR(191) NOT NULL,
  `articleNumberSnapshot` VARCHAR(191) NOT NULL,
  `stemNumberSnapshot` VARCHAR(191) NOT NULL,
  `descriptionNlSnapshot` TEXT NOT NULL,
  `descriptionFrSnapshot` TEXT NOT NULL,
  `descriptionDeSnapshot` TEXT NOT NULL,
  `quantity` DECIMAL(14,3) NOT NULL,
  `unitPriceSnapshot` DECIMAL(14,4) NOT NULL,
  `unitCostSnapshot` DECIMAL(14,4) NOT NULL,
  `lineAmount` DECIMAL(14,2) NOT NULL,
  `lineCost` DECIMAL(14,2) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ContractCalculationLine_calculationId_idx` (`calculationId`),
  INDEX `ContractCalculationLine_articleId_idx` (`articleId`),
  INDEX `ContractCalculationLine_sortOrder_idx` (`sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ContractImportRun` (
  `id` VARCHAR(191) NOT NULL,
  `status` ENUM('VALIDATING','PREVIEW_READY','IMPORTED','FAILED','CANCELLED') NOT NULL DEFAULT 'VALIDATING',
  `sourceFileName` VARCHAR(191) NOT NULL,
  `sourceFileSha256` VARCHAR(191) NOT NULL,
  `sourceWorkbookVersion` VARCHAR(191) NULL,
  `modelVersionId` VARCHAR(191) NULL,
  `startedByUserId` VARCHAR(191) NOT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt` DATETIME(3) NULL,
  `foundArticles` INTEGER NOT NULL DEFAULT 0,
  `newArticles` INTEGER NOT NULL DEFAULT 0,
  `changedArticles` INTEGER NOT NULL DEFAULT 0,
  `deactivatedArticles` INTEGER NOT NULL DEFAULT 0,
  `unchangedArticles` INTEGER NOT NULL DEFAULT 0,
  `errorCount` INTEGER NOT NULL DEFAULT 0,
  `warningCount` INTEGER NOT NULL DEFAULT 0,
  `previewJson` LONGTEXT NULL,
  `errorJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ContractImportRun_status_startedAt_idx` (`status`, `startedAt`),
  INDEX `ContractImportRun_sourceFileSha256_idx` (`sourceFileSha256`),
  INDEX `ContractImportRun_modelVersionId_idx` (`modelVersionId`),
  INDEX `ContractImportRun_startedByUserId_idx` (`startedByUserId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ContractModelVersion`
  ADD CONSTRAINT `ContractModelVersion_activatedByUserId_fkey` FOREIGN KEY (`activatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractModelVersion_importedByUserId_fkey` FOREIGN KEY (`importedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ContractArticle`
  ADD CONSTRAINT `ContractArticle_sourceModelVersionId_fkey` FOREIGN KEY (`sourceModelVersionId`) REFERENCES `ContractModelVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ContractCustomer`
  ADD CONSTRAINT `ContractCustomer_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractCustomer_teamIdSnapshot_fkey` FOREIGN KEY (`teamIdSnapshot`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ContractTermRule`
  ADD CONSTRAINT `ContractTermRule_modelVersionId_fkey` FOREIGN KEY (`modelVersionId`) REFERENCES `ContractModelVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ContractCalculation`
  ADD CONSTRAINT `ContractCalculation_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `ContractCustomer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractCalculation_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractCalculation_teamIdSnapshot_fkey` FOREIGN KEY (`teamIdSnapshot`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractCalculation_modelVersionId_fkey` FOREIGN KEY (`modelVersionId`) REFERENCES `ContractModelVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContractCalculationLine`
  ADD CONSTRAINT `ContractCalculationLine_calculationId_fkey` FOREIGN KEY (`calculationId`) REFERENCES `ContractCalculation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractCalculationLine_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `ContractArticle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContractImportRun`
  ADD CONSTRAINT `ContractImportRun_modelVersionId_fkey` FOREIGN KEY (`modelVersionId`) REFERENCES `ContractModelVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractImportRun_startedByUserId_fkey` FOREIGN KEY (`startedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `Permission` (`id`, `key`, `label`, `group`, `description`, `createdAt`, `updatedAt`)
VALUES
  ('perm-contract-articles-manage', 'contractArticlesManage', 'Contractartikelen beheren', 'Contractcalculatie', 'Contractartikelen beheren binnen de toegestane beheerscope.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-contract-imports-manage', 'contractImportsManage', 'Contractimport beheren', 'Contractcalculatie', 'Excel-imports valideren en bevestigen voor Contractcalculatie.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-contract-models-manage', 'contractModelsManage', 'Contractmodellen beheren', 'Contractcalculatie', 'Contractmodelversies activeren en heractiveren.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `group` = VALUES(`group`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('rp-contract-menu-', role_seed.`role_name`, '-', permission_record.`id`), role_seed.`role_name`, permission_record.`id`, true
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
  ON permission_record.`key` IN ('menu.contract.enabled', 'menu.contract.open')
ON DUPLICATE KEY UPDATE `enabled` = true;

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('rp-contract-manage-', role_seed.`role_name`, '-', permission_record.`id`), role_seed.`role_name`, permission_record.`id`, true
FROM (
  SELECT 'ADMIN' AS `role_name`
  UNION SELECT 'SUPER_ADMIN'
) AS role_seed
JOIN `Permission` AS permission_record
  ON permission_record.`key` IN ('contractArticlesManage', 'contractImportsManage', 'contractModelsManage')
ON DUPLICATE KEY UPDATE `enabled` = true;
