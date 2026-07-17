CREATE TABLE `SalesPreparationState` (
  `id` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `preparedById` VARCHAR(191) NOT NULL,
  `preparedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesPreparationState_appointmentId_key` (`appointmentId`),
  INDEX `SalesPreparationState_preparedById_preparedAt_idx` (`preparedById`, `preparedAt`),
  CONSTRAINT `SalesPreparationState_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `SalesAppointment` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesPreparationState_preparedById_fkey` FOREIGN KEY (`preparedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE `SalesPreparationNote` (
  `id` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `authorUserId` VARCHAR(191) NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesPreparationNote_appointmentId_key` (`appointmentId`),
  INDEX `SalesPreparationNote_authorUserId_updatedAt_idx` (`authorUserId`, `updatedAt`),
  CONSTRAINT `SalesPreparationNote_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `SalesAppointment` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesPreparationNote_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE `SalesPreparationRecommendationFeedback` (
  `id` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `articleExternalId` VARCHAR(191) NOT NULL,
  `relevant` BOOLEAN NULL,
  `addedManually` BOOLEAN NOT NULL DEFAULT false,
  `comment` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesPreparationRecommendationFeedback_appointmentId_articleExternalId_key` (`appointmentId`, `articleExternalId`),
  INDEX `SalesPreparationRecommendationFeedback_actorUserId_updatedAt_idx` (`actorUserId`, `updatedAt`),
  CONSTRAINT `SalesPreparationRecommendationFeedback_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `SalesAppointment` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesPreparationRecommendationFeedback_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE `SalesCommercialHistoryDocument` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK', 'BC_NAV', 'ODOO') NOT NULL,
  `externalId` VARCHAR(191) NOT NULL,
  `sourceVersion` VARCHAR(191) NOT NULL,
  `sourceUpdatedAt` DATETIME(3) NOT NULL,
  `documentType` VARCHAR(191) NOT NULL,
  `documentNumber` VARCHAR(191) NOT NULL,
  `documentDate` DATE NOT NULL,
  `relationId` VARCHAR(191) NOT NULL,
  `representativeExternalId` VARCHAR(191) NULL,
  `currency` VARCHAR(191) NOT NULL,
  `amountExcludingVat` DECIMAL(14,2) NOT NULL,
  `amountIncludingVat` DECIMAL(14,2) NOT NULL,
  `paymentStatus` VARCHAR(191) NOT NULL,
  `openAmount` DECIMAL(14,2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesCommercialHistoryDocument_provider_externalId_key` (`provider`, `externalId`),
  INDEX `SalesCommercialHistoryDocument_relationId_documentDate_idx` (`relationId`, `documentDate`),
  INDEX `SalesCommercialHistoryDocument_documentType_documentDate_idx` (`documentType`, `documentDate`),
  CONSTRAINT `SalesCommercialHistoryDocument_relationId_fkey` FOREIGN KEY (`relationId`) REFERENCES `BusinessRelation` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE `SalesCommercialHistoryLine` (
  `id` VARCHAR(191) NOT NULL,
  `documentId` VARCHAR(191) NOT NULL,
  `lineNumber` INTEGER NOT NULL,
  `articleExternalId` VARCHAR(191) NOT NULL,
  `articleNumberSnapshot` VARCHAR(191) NOT NULL,
  `descriptionSnapshot` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(14,3) NOT NULL,
  `unitSnapshot` VARCHAR(191) NOT NULL,
  `unitPriceSnapshot` DECIMAL(14,4) NOT NULL,
  `vatRateSnapshot` DECIMAL(7,4) NOT NULL,
  `lineAmountExcludingVat` DECIMAL(14,2) NOT NULL,
  `carrierExternalId` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesCommercialHistoryLine_documentId_lineNumber_key` (`documentId`, `lineNumber`),
  INDEX `SalesCommercialHistoryLine_articleExternalId_idx` (`articleExternalId`),
  CONSTRAINT `SalesCommercialHistoryLine_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `SalesCommercialHistoryDocument` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
