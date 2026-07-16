CREATE TABLE `ErpInboxMessage` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK','BC_NAV','ODOO') NOT NULL,
  `messageId` VARCHAR(191) NOT NULL,
  `schemaVersion` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `entityExternalId` VARCHAR(191) NOT NULL,
  `sourceVersion` VARCHAR(191) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `eventFingerprint` CHAR(64) NOT NULL,
  `status` ENUM('RECEIVED','PROCESSING','APPLIED','RETRYABLE','FAILED') NOT NULL DEFAULT 'RECEIVED',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `nextAttemptAt` DATETIME(3) NULL,
  `leaseOwner` VARCHAR(191) NULL,
  `leaseExpiresAt` DATETIME(3) NULL,
  `appliedAt` DATETIME(3) NULL,
  `lastErrorCode` VARCHAR(191) NULL,
  `lastErrorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ErpInboxMessage_provider_messageId_key` (`provider`, `messageId`),
  INDEX `ErpInboxMessage_status_nextAttemptAt_leaseExpiresAt_idx` (`status`, `nextAttemptAt`, `leaseExpiresAt`),
  INDEX `ErpInboxMessage_provider_eventType_entityExternalId_idx` (`provider`, `eventType`, `entityExternalId`),
  INDEX `ErpInboxMessage_occurredAt_idx` (`occurredAt`)
);

CREATE TABLE `ErpOutboxCommand` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK','BC_NAV','ODOO') NOT NULL,
  `commandId` VARCHAR(191) NOT NULL,
  `schemaVersion` VARCHAR(191) NOT NULL,
  `commandType` VARCHAR(191) NOT NULL,
  `businessKey` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `commandFingerprint` CHAR(64) NOT NULL,
  `issuedAt` DATETIME(3) NOT NULL,
  `conflictPriority` VARCHAR(191) NOT NULL DEFAULT 'FIELDFORCE',
  `contextJson` LONGTEXT NOT NULL,
  `payloadJson` LONGTEXT NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `representativeExternalId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `country` ENUM('BE','NL','DE') NOT NULL,
  `appointmentExternalId` VARCHAR(191) NULL,
  `businessDate` DATE NULL,
  `status` ENUM('PENDING','PROCESSING','ACCEPTED','REJECTED','RETRYABLE') NOT NULL DEFAULT 'PENDING',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `nextAttemptAt` DATETIME(3) NULL,
  `lastAttemptAt` DATETIME(3) NULL,
  `leaseOwner` VARCHAR(191) NULL,
  `leaseExpiresAt` DATETIME(3) NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `externalEntityId` VARCHAR(191) NULL,
  `acknowledgedSourceVersion` VARCHAR(191) NULL,
  `acknowledgementJson` LONGTEXT NULL,
  `lastErrorCode` VARCHAR(191) NULL,
  `lastErrorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ErpOutboxCommand_commandId_key` (`commandId`),
  UNIQUE INDEX `ErpOutboxCommand_provider_idempotencyKey_key` (`provider`, `idempotencyKey`),
  INDEX `ErpOutboxCommand_status_nextAttemptAt_leaseExpiresAt_idx` (`status`, `nextAttemptAt`, `leaseExpiresAt`),
  INDEX `ErpOutboxCommand_actorUserId_businessDate_status_idx` (`actorUserId`, `businessDate`, `status`),
  INDEX `ErpOutboxCommand_provider_commandType_businessKey_idx` (`provider`, `commandType`, `businessKey`),
  INDEX `ErpOutboxCommand_appointmentExternalId_idx` (`appointmentExternalId`)
);

CREATE TABLE `ErpOutboxDependency` (
  `id` VARCHAR(191) NOT NULL,
  `commandId` VARCHAR(191) NOT NULL,
  `dependsOnCommandId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ErpOutboxDependency_commandId_dependsOnCommandId_key` (`commandId`, `dependsOnCommandId`),
  INDEX `ErpOutboxDependency_dependsOnCommandId_idx` (`dependsOnCommandId`)
);

CREATE TABLE `ErpReplicaCheckpoint` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK','BC_NAV','ODOO') NOT NULL,
  `streamKey` VARCHAR(191) NOT NULL,
  `scopeKey` VARCHAR(191) NOT NULL,
  `schemaVersion` VARCHAR(191) NOT NULL,
  `cursor` LONGTEXT NOT NULL,
  `sourceCheckpoint` LONGTEXT NULL,
  `lastSuccessfulSyncAt` DATETIME(3) NOT NULL,
  `lastEventOccurredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ErpReplicaCheckpoint_provider_streamKey_scopeKey_key` (`provider`, `streamKey`, `scopeKey`),
  INDEX `ErpReplicaCheckpoint_provider_lastSuccessfulSyncAt_idx` (`provider`, `lastSuccessfulSyncAt`)
);

CREATE TABLE `ErpReconciliationIncident` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK','BC_NAV','ODOO') NOT NULL,
  `type` ENUM('COMMAND_UNKNOWN','ACKNOWLEDGEMENT_MISMATCH','EVENT_PAYLOAD_CONFLICT','EVENT_APPLY_FAILED','CHECKPOINT_INVALID','PERMISSION_REVOKED','AUTHORIZATION_ERROR','DEPENDENCY_REJECTED','REPEATED_FAILURE','PROVIDER_ERROR') NOT NULL,
  `status` ENUM('OPEN','RESOLVED','IGNORED') NOT NULL DEFAULT 'OPEN',
  `deduplicationKey` VARCHAR(191) NOT NULL,
  `commandId` VARCHAR(191) NULL,
  `entityType` VARCHAR(191) NULL,
  `entityExternalId` VARCHAR(191) NULL,
  `summary` TEXT NOT NULL,
  `detailsJson` LONGTEXT NULL,
  `occurrenceCount` INTEGER NOT NULL DEFAULT 1,
  `firstDetectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastDetectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolvedAt` DATETIME(3) NULL,
  `resolvedByUserId` VARCHAR(191) NULL,
  `resolutionNote` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ErpReconciliationIncident_provider_deduplicationKey_key` (`provider`, `deduplicationKey`),
  INDEX `ErpReconciliationIncident_status_type_lastDetectedAt_idx` (`status`, `type`, `lastDetectedAt`),
  INDEX `ErpReconciliationIncident_commandId_idx` (`commandId`),
  INDEX `ErpReconciliationIncident_entityType_entityExternalId_idx` (`entityType`, `entityExternalId`)
);

ALTER TABLE `ErpOutboxCommand`
  ADD CONSTRAINT `ErpOutboxCommand_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ErpOutboxDependency`
  ADD CONSTRAINT `ErpOutboxDependency_commandId_fkey` FOREIGN KEY (`commandId`) REFERENCES `ErpOutboxCommand`(`commandId`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ErpOutboxDependency_dependsOnCommandId_fkey` FOREIGN KEY (`dependsOnCommandId`) REFERENCES `ErpOutboxCommand`(`commandId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ErpReconciliationIncident`
  ADD CONSTRAINT `ErpReconciliationIncident_commandId_fkey` FOREIGN KEY (`commandId`) REFERENCES `ErpOutboxCommand`(`commandId`) ON DELETE SET NULL ON UPDATE CASCADE;
