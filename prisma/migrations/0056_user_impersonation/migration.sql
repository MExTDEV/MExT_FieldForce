CREATE TABLE `ImpersonationSession` (
  `id` VARCHAR(191) NOT NULL,
  `loginSessionId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `impersonatedUserId` VARCHAR(191) NOT NULL,
  `reasonType` VARCHAR(64) NOT NULL,
  `reasonText` TEXT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `endedAt` DATETIME(3) NULL,
  `endReason` ENUM('MANUAL', 'LOGOUT', 'EXPIRED', 'PERMISSION_REVOKED', 'TARGET_DEACTIVATED', 'ADMINISTRATIVE', 'REPLACED') NULL,
  `targetCountry` ENUM('BE', 'NL', 'DE') NOT NULL,
  `targetTeamId` VARCHAR(191) NULL,
  `targetTeamName` VARCHAR(191) NULL,
  `ipAddress` VARCHAR(191) NULL,
  `userAgent` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ImpersonationSession_loginSessionId_endedAt_expiresAt_idx` (`loginSessionId`, `endedAt`, `expiresAt`),
  INDEX `ImpersonationSession_actorUserId_startedAt_idx` (`actorUserId`, `startedAt`),
  INDEX `ImpersonationSession_impersonatedUserId_startedAt_idx` (`impersonatedUserId`, `startedAt`),
  INDEX `ImpersonationSession_targetCountry_startedAt_idx` (`targetCountry`, `startedAt`),
  INDEX `ImpersonationSession_targetTeamId_startedAt_idx` (`targetTeamId`, `startedAt`),
  CONSTRAINT `ImpersonationSession_loginSessionId_fkey` FOREIGN KEY (`loginSessionId`) REFERENCES `UserLoginSession` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ImpersonationSession_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ImpersonationSession_impersonatedUserId_fkey` FOREIGN KEY (`impersonatedUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ImpersonationEvent` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `impersonatedUserId` VARCHAR(191) NULL,
  `type` ENUM('IMPERSONATION_STARTED', 'IMPERSONATION_STOPPED', 'IMPERSONATION_EXPIRED', 'IMPERSONATION_DENIED') NOT NULL,
  `reason` TEXT NULL,
  `ipAddress` VARCHAR(191) NULL,
  `userAgent` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ImpersonationEvent_sessionId_createdAt_idx` (`sessionId`, `createdAt`),
  INDEX `ImpersonationEvent_actorUserId_createdAt_idx` (`actorUserId`, `createdAt`),
  INDEX `ImpersonationEvent_impersonatedUserId_createdAt_idx` (`impersonatedUserId`, `createdAt`),
  INDEX `ImpersonationEvent_type_createdAt_idx` (`type`, `createdAt`),
  CONSTRAINT `ImpersonationEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ImpersonationSession` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ImpersonationEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ImpersonationEvent_impersonatedUserId_fkey` FOREIGN KEY (`impersonatedUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuditLog`
  ADD COLUMN `effectiveUserId` VARCHAR(191) NULL,
  ADD COLUMN `impersonationSessionId` VARCHAR(191) NULL,
  ADD COLUMN `ipAddress` VARCHAR(191) NULL,
  ADD COLUMN `userAgent` TEXT NULL,
  ADD INDEX `AuditLog_effectiveUserId_createdAt_idx` (`effectiveUserId`, `createdAt`),
  ADD INDEX `AuditLog_impersonationSessionId_createdAt_idx` (`impersonationSessionId`, `createdAt`);

INSERT INTO `Permission` (`id`, `key`, `label`, `group`, `description`, `createdAt`, `updatedAt`)
VALUES
  ('perm_users_impersonate', 'users.impersonate', 'Gebruikers impersonaten', 'Gebruikersbeheer', 'Laat toe om tijdelijk als een andere gebruiker in FieldForce te werken.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm_audit_impersonation_read', 'audit.impersonation.read', 'Impersonatiehistoriek bekijken', 'Gebruikersbeheer', 'Laat toe om de beveiligingshistoriek van impersonatiesessies te bekijken.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`), `group` = VALUES(`group`), `description` = VALUES(`description`), `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('rp_imp_', LOWER(`role`)), `role`, 'perm_users_impersonate', TRUE
FROM (SELECT 'SALES_MANAGER' AS `role` UNION ALL SELECT 'COUNTRY_MANAGER' UNION ALL SELECT 'GROUP_MANAGER' UNION ALL SELECT 'ADMIN' UNION ALL SELECT 'SUPER_ADMIN') defaults
ON DUPLICATE KEY UPDATE `enabled` = VALUES(`enabled`);

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('rp_audit_imp_', LOWER(`role`)), `role`, 'perm_audit_impersonation_read', TRUE
FROM (SELECT 'GROUP_MANAGER' AS `role` UNION ALL SELECT 'ADMIN' UNION ALL SELECT 'SUPER_ADMIN') defaults
ON DUPLICATE KEY UPDATE `enabled` = VALUES(`enabled`);
