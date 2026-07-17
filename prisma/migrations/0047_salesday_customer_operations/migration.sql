CREATE TABLE `SalesAppointment` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK', 'BC_NAV', 'ODOO') NULL,
  `externalId` VARCHAR(191) NULL,
  `sourceVersion` VARCHAR(191) NULL,
  `sourceUpdatedAt` DATETIME(3) NULL,
  `businessDate` DATE NOT NULL,
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `timeZone` VARCHAR(191) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `status` ENUM('PLANNED', 'COMPLETED', 'NOT_COMPLETED', 'MOVED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
  `origin` ENUM('ERP', 'REPRESENTATIVE') NOT NULL DEFAULT 'ERP',
  `relationId` VARCHAR(191) NOT NULL,
  `representativeUserId` VARCHAR(191) NOT NULL,
  `representativeExternalId` VARCHAR(191) NOT NULL,
  `teamId` VARCHAR(191) NULL,
  `teamExternalId` VARCHAR(191) NULL,
  `country` ENUM('BE', 'NL', 'DE') NOT NULL,
  `outcomeReasonExternalId` VARCHAR(191) NULL,
  `outcomeComment` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesAppointment_provider_externalId_key` (`provider`, `externalId`),
  INDEX `SalesAppointment_representativeUserId_businessDate_sequence_idx` (`representativeUserId`, `businessDate`, `sequence`),
  INDEX `SalesAppointment_relationId_businessDate_idx` (`relationId`, `businessDate`),
  INDEX `SalesAppointment_teamId_businessDate_idx` (`teamId`, `businessDate`),
  INDEX `SalesAppointment_country_businessDate_idx` (`country`, `businessDate`),
  INDEX `SalesAppointment_status_businessDate_idx` (`status`, `businessDate`),
  CONSTRAINT `SalesAppointment_relationId_fkey`
    FOREIGN KEY (`relationId`) REFERENCES `BusinessRelation` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesAppointment_representativeUserId_fkey`
    FOREIGN KEY (`representativeUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesAppointment_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE `BusinessRelationChange` (
  `id` VARCHAR(191) NOT NULL,
  `relationId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `appointmentExternalId` VARCHAR(191) NULL,
  `oldValueJson` LONGTEXT NOT NULL,
  `proposedValueJson` LONGTEXT NOT NULL,
  `validationJson` LONGTEXT NOT NULL,
  `commandId` VARCHAR(191) NOT NULL,
  `erpAcknowledgedAt` DATETIME(3) NULL,
  `erpAcknowledgementJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BusinessRelationChange_commandId_key` (`commandId`),
  INDEX `BusinessRelationChange_relationId_createdAt_idx` (`relationId`, `createdAt`),
  INDEX `BusinessRelationChange_actorUserId_createdAt_idx` (`actorUserId`, `createdAt`),
  INDEX `BusinessRelationChange_appointmentExternalId_idx` (`appointmentExternalId`),
  INDEX `BusinessRelationChange_erpAcknowledgedAt_idx` (`erpAcknowledgedAt`),
  CONSTRAINT `BusinessRelationChange_relationId_fkey`
    FOREIGN KEY (`relationId`) REFERENCES `BusinessRelation` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `BusinessRelationChange_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);
