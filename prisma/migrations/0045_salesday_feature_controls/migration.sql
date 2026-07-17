CREATE TABLE `SalesDayFeatureFlag` (
  `id` VARCHAR(191) NOT NULL,
  `key` ENUM('SALESDAY', 'INVENTORY', 'OFFLINE_COMMANDS', 'ERP_WRITES') NOT NULL,
  `scope` ENUM('GLOBAL', 'COUNTRY', 'TEAM', 'USER') NOT NULL,
  `scopeKey` VARCHAR(191) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `country` ENUM('BE', 'NL', 'DE') NULL,
  `teamId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `updatedById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesDayFeatureFlag_scopeKey_key` (`scopeKey`),
  INDEX `SalesDayFeatureFlag_key_scope_enabled_idx` (`key`, `scope`, `enabled`),
  INDEX `SalesDayFeatureFlag_country_key_idx` (`country`, `key`),
  INDEX `SalesDayFeatureFlag_teamId_key_idx` (`teamId`, `key`),
  INDEX `SalesDayFeatureFlag_userId_key_idx` (`userId`, `key`),
  INDEX `SalesDayFeatureFlag_updatedById_idx` (`updatedById`),
  CONSTRAINT `SalesDayFeatureFlag_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SalesDayFeatureFlag_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SalesDayFeatureFlag_updatedById_fkey`
    FOREIGN KEY (`updatedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO `Permission` (`id`, `key`, `label`, `group`, `description`, `createdAt`, `updatedAt`)
VALUES
  ('permission-salesday-settings-manage', 'salesday.settings.manage', 'SalesDay-activatie en runtime beheren', 'SalesDay', 'Fail-closed SalesDay-vlaggen en server-runtimeconfiguratie beheren.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('permission-salesday-integration-monitor', 'salesday.integration.monitor', 'SalesDay-integratie opvolgen', 'SalesDay', 'Operationele integratiestatus en synchronisatie-incidenten opvolgen.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `group` = VALUES(`group`),
  `description` = VALUES(`description`),
  `updatedAt` = VALUES(`updatedAt`);

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('role-permission-', permission_record.`key`, '-super-admin'), 'SUPER_ADMIN', permission_record.`id`, true
FROM `Permission` AS permission_record
WHERE permission_record.`key` IN ('salesday.settings.manage', 'salesday.integration.monitor')
ON DUPLICATE KEY UPDATE `enabled` = VALUES(`enabled`);
