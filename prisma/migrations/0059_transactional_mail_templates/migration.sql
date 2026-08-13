CREATE TABLE `MailType` (
  `id` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `moduleCode` VARCHAR(191) NOT NULL,
  `functionalNameNl` VARCHAR(191) NOT NULL,
  `descriptionNl` TEXT NOT NULL,
  `triggerDescriptionNl` TEXT NOT NULL,
  `systemFallbackKey` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MailType_key_key` (`key`),
  INDEX `MailType_moduleCode_active_idx` (`moduleCode`, `active`),
  CONSTRAINT `MailType_moduleCode_fkey` FOREIGN KEY (`moduleCode`) REFERENCES `app_modules` (`code`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MailParameterDefinition` (
  `id` VARCHAR(191) NOT NULL,
  `mailTypeId` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `labelNl` VARCHAR(191) NOT NULL,
  `descriptionNl` TEXT NOT NULL,
  `dataType` VARCHAR(191) NOT NULL,
  `exampleValue` TEXT NULL,
  `required` BOOLEAN NOT NULL DEFAULT false,
  `formatter` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MailParameterDefinition_mailTypeId_key_key` (`mailTypeId`, `key`),
  INDEX `MailParameterDefinition_mailTypeId_sortOrder_idx` (`mailTypeId`, `sortOrder`),
  CONSTRAINT `MailParameterDefinition_mailTypeId_fkey` FOREIGN KEY (`mailTypeId`) REFERENCES `MailType` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MailAsset` (
  `id` VARCHAR(191) NOT NULL,
  `storageKey` VARCHAR(191) NOT NULL,
  `publicUrl` VARCHAR(191) NOT NULL,
  `originalName` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(191) NOT NULL,
  `byteSize` INTEGER NOT NULL,
  `altText` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `uploadedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MailAsset_storageKey_key` (`storageKey`),
  INDEX `MailAsset_active_createdAt_idx` (`active`, `createdAt`),
  CONSTRAINT `MailAsset_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MailTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `mailTypeId` VARCHAR(191) NOT NULL,
  `scopeLevel` ENUM('GLOBAL','COUNTRY','MODULE','MODULE_COUNTRY') NOT NULL,
  `scopeKey` VARCHAR(191) NOT NULL,
  `country` ENUM('BE','NL','DE') NULL,
  `moduleCode` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MailTemplate_mailTypeId_scopeKey_key` (`mailTypeId`, `scopeKey`),
  INDEX `MailTemplate_scopeLevel_country_moduleCode_idx` (`scopeLevel`, `country`, `moduleCode`),
  CONSTRAINT `MailTemplate_mailTypeId_fkey` FOREIGN KEY (`mailTypeId`) REFERENCES `MailType` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MailTemplateVersion` (
  `id` VARCHAR(191) NOT NULL,
  `templateId` VARCHAR(191) NOT NULL,
  `language` ENUM('nl','fr','de') NOT NULL,
  `version` INTEGER NOT NULL,
  `status` ENUM('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
  `subject` VARCHAR(191) NOT NULL,
  `preheader` VARCHAR(191) NULL,
  `bodyHtml` LONGTEXT NOT NULL,
  `parameterKeysJson` LONGTEXT NOT NULL,
  `changeNote` TEXT NULL,
  `createdById` VARCHAR(191) NULL,
  `publishedAt` DATETIME(3) NULL,
  `restoredFromId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MailTemplateVersion_templateId_language_version_key` (`templateId`, `language`, `version`),
  INDEX `MailTemplateVersion_templateId_language_status_idx` (`templateId`, `language`, `status`),
  CONSTRAINT `MailTemplateVersion_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `MailTemplate` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MailTemplateVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `MailTemplateVersion_restoredFromId_fkey` FOREIGN KEY (`restoredFromId`) REFERENCES `MailTemplateVersion` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MailCountryProfile` (
  `id` VARCHAR(191) NOT NULL,
  `country` ENUM('BE','NL','DE') NOT NULL,
  `senderName` VARCHAR(191) NULL,
  `replyToEmail` VARCHAR(191) NULL,
  `supportEmail` VARCHAR(191) NULL,
  `supportPhone` VARCHAR(191) NULL,
  `legalTextJson` LONGTEXT NULL,
  `logoAssetId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MailCountryProfile_country_key` (`country`),
  CONSTRAINT `MailCountryProfile_logoAssetId_fkey` FOREIGN KEY (`logoAssetId`) REFERENCES `MailAsset` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MailFooter` (
  `id` VARCHAR(191) NOT NULL,
  `profileId` VARCHAR(191) NOT NULL,
  `language` ENUM('nl','fr','de') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MailFooter_profileId_language_key` (`profileId`, `language`),
  CONSTRAINT `MailFooter_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `MailCountryProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MailFooterVersion` (
  `id` VARCHAR(191) NOT NULL,
  `footerId` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `status` ENUM('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
  `bodyHtml` LONGTEXT NOT NULL,
  `changeNote` TEXT NULL,
  `createdById` VARCHAR(191) NULL,
  `publishedAt` DATETIME(3) NULL,
  `restoredFromId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MailFooterVersion_footerId_version_key` (`footerId`, `version`),
  INDEX `MailFooterVersion_footerId_status_idx` (`footerId`, `status`),
  CONSTRAINT `MailFooterVersion_footerId_fkey` FOREIGN KEY (`footerId`) REFERENCES `MailFooter` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MailFooterVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `MailFooterVersion_restoredFromId_fkey` FOREIGN KEY (`restoredFromId`) REFERENCES `MailFooterVersion` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MailTemplateAsset` (
  `templateId` VARCHAR(191) NOT NULL,
  `assetId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`templateId`, `assetId`),
  INDEX `MailTemplateAsset_assetId_idx` (`assetId`),
  CONSTRAINT `MailTemplateAsset_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `MailTemplate` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MailTemplateAsset_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `MailAsset` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NotificationDelivery`
  ADD COLUMN `templateVersionId` VARCHAR(191) NULL,
  ADD COLUMN `templateLanguage` ENUM('nl','fr','de') NULL,
  ADD COLUMN `templateCountry` ENUM('BE','NL','DE') NULL,
  ADD COLUMN `redirected` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `correlationId` VARCHAR(191) NULL,
  ADD COLUMN `providerResult` TEXT NULL,
  ADD COLUMN `retryCount` INTEGER NOT NULL DEFAULT 0,
  ADD INDEX `NotificationDelivery_templateVersionId_createdAt_idx` (`templateVersionId`, `createdAt`),
  ADD INDEX `NotificationDelivery_correlationId_idx` (`correlationId`),
  ADD CONSTRAINT `NotificationDelivery_templateVersionId_fkey` FOREIGN KEY (`templateVersionId`) REFERENCES `MailTemplateVersion` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
