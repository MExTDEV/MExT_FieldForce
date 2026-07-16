ALTER TABLE `ContractCalculation`
  ADD COLUMN `contractLetterTemplateId` VARCHAR(191) NULL,
  ADD COLUMN `contractLetterLanguage` ENUM('nl','fr','de') NULL,
  ADD COLUMN `contractLetterGeneratedAt` DATETIME(3) NULL,
  ADD INDEX `ContractCalculation_contractLetterTemplateId_idx` (`contractLetterTemplateId`);

CREATE TABLE `ContractLetterTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `language` ENUM('nl','fr','de') NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `status` ENUM('DRAFT','ACTIVE','INACTIVE','FAILED') NOT NULL DEFAULT 'DRAFT',
  `sourceFileName` VARCHAR(191) NOT NULL,
  `sourceFileSha256` VARCHAR(191) NOT NULL,
  `sourceMimeType` VARCHAR(191) NOT NULL,
  `sourceContent` LONGTEXT NOT NULL,
  `usedParametersJson` LONGTEXT NOT NULL,
  `validationJson` LONGTEXT NOT NULL,
  `uploadedByUserId` VARCHAR(191) NOT NULL,
  `activatedByUserId` VARCHAR(191) NULL,
  `activatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContractLetterTemplate_language_version_key` (`language`, `version`),
  INDEX `ContractLetterTemplate_language_status_idx` (`language`, `status`),
  INDEX `ContractLetterTemplate_sourceFileSha256_idx` (`sourceFileSha256`),
  INDEX `ContractLetterTemplate_uploadedByUserId_idx` (`uploadedByUserId`),
  INDEX `ContractLetterTemplate_activatedByUserId_idx` (`activatedByUserId`)
);

CREATE TABLE `ContractGeneratedDocument` (
  `id` VARCHAR(191) NOT NULL,
  `calculationId` VARCHAR(191) NOT NULL,
  `templateId` VARCHAR(191) NOT NULL,
  `language` ENUM('nl','fr','de') NOT NULL,
  `documentVersion` INTEGER NOT NULL,
  `placeholderSnapshotJson` LONGTEXT NOT NULL,
  `generatedFileName` VARCHAR(191) NOT NULL,
  `unsignedPdfStorageKey` VARCHAR(191) NULL,
  `signedPdfStorageKey` VARCHAR(191) NOT NULL,
  `unsignedPdfSha256` VARCHAR(191) NULL,
  `signedPdfSha256` VARCHAR(191) NOT NULL,
  `generatedByUserId` VARCHAR(191) NOT NULL,
  `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `signedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ContractGeneratedDocument_calculationId_documentVersion_key` (`calculationId`, `documentVersion`),
  INDEX `ContractGeneratedDocument_templateId_idx` (`templateId`),
  INDEX `ContractGeneratedDocument_generatedByUserId_idx` (`generatedByUserId`),
  INDEX `ContractGeneratedDocument_language_idx` (`language`)
);

ALTER TABLE `ContractCalculation`
  ADD CONSTRAINT `ContractCalculation_contractLetterTemplateId_fkey` FOREIGN KEY (`contractLetterTemplateId`) REFERENCES `ContractLetterTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ContractLetterTemplate`
  ADD CONSTRAINT `ContractLetterTemplate_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractLetterTemplate_activatedByUserId_fkey` FOREIGN KEY (`activatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ContractGeneratedDocument`
  ADD CONSTRAINT `ContractGeneratedDocument_calculationId_fkey` FOREIGN KEY (`calculationId`) REFERENCES `ContractCalculation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractGeneratedDocument_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractLetterTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ContractGeneratedDocument_generatedByUserId_fkey` FOREIGN KEY (`generatedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
