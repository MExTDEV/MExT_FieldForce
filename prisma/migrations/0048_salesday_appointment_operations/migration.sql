ALTER TABLE `SalesAppointment`
  ADD COLUMN `nativeStatus` VARCHAR(191) NULL,
  ADD COLUMN `localRevision` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `pendingFieldForceEdit` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `SalesAppointmentChange` (
  `id` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `type` ENUM('CREATE', 'EDIT', 'DUPLICATE', 'OUTCOME') NOT NULL,
  `oldValueJson` LONGTEXT NOT NULL,
  `proposedValueJson` LONGTEXT NOT NULL,
  `validationJson` LONGTEXT NOT NULL,
  `commandId` VARCHAR(191) NOT NULL,
  `erpAcknowledgedAt` DATETIME(3) NULL,
  `erpAcknowledgementJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesAppointmentChange_commandId_key` (`commandId`),
  INDEX `SalesAppointmentChange_appointmentId_createdAt_idx` (`appointmentId`, `createdAt`),
  INDEX `SalesAppointmentChange_actorUserId_createdAt_idx` (`actorUserId`, `createdAt`),
  INDEX `SalesAppointmentChange_erpAcknowledgedAt_idx` (`erpAcknowledgedAt`),
  CONSTRAINT `SalesAppointmentChange_appointmentId_fkey`
    FOREIGN KEY (`appointmentId`) REFERENCES `SalesAppointment` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesAppointmentChange_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE `SalesAppointmentOutcomeReason` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK', 'BC_NAV', 'ODOO') NOT NULL,
  `externalId` VARCHAR(191) NOT NULL,
  `sourceVersion` VARCHAR(191) NOT NULL,
  `sourceUpdatedAt` DATETIME(3) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `labelNl` VARCHAR(191) NOT NULL,
  `labelFr` VARCHAR(191) NOT NULL,
  `labelDe` VARCHAR(191) NOT NULL,
  `country` ENUM('BE', 'NL', 'DE') NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `requiresComment` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesAppointmentOutcomeReason_provider_externalId_key` (`provider`, `externalId`),
  INDEX `SalesAppointmentOutcomeReason_country_active_code_idx` (`country`, `active`, `code`)
);
