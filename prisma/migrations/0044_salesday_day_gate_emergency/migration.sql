CREATE TABLE `SalesDayEmergencyMode` (
  `id` VARCHAR(191) NOT NULL,
  `activeKey` VARCHAR(32) NULL,
  `reason` TEXT NOT NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `activatedByUserId` VARCHAR(191) NOT NULL,
  `deactivatedAt` DATETIME(3) NULL,
  `deactivatedByUserId` VARCHAR(191) NULL,
  `deactivationReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesDayEmergencyMode_activeKey_key` (`activeKey`),
  INDEX `SalesDayEmergencyMode_startsAt_endsAt_idx` (`startsAt`, `endsAt`),
  INDEX `SalesDayEmergencyMode_activatedByUserId_createdAt_idx` (`activatedByUserId`, `createdAt`),
  INDEX `SalesDayEmergencyMode_deactivatedByUserId_idx` (`deactivatedByUserId`),
  CONSTRAINT `SalesDayEmergencyMode_activatedByUserId_fkey`
    FOREIGN KEY (`activatedByUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesDayEmergencyMode_deactivatedByUserId_fkey`
    FOREIGN KEY (`deactivatedByUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO `Permission` (`id`, `key`, `label`, `group`, `description`, `createdAt`, `updatedAt`)
VALUES (
  'permission-salesday-emergency-mode-manage',
  'salesday.emergencyMode.manage',
  'SalesDay-noodmodus beheren',
  'SalesDay',
  'Centraal een tijdelijke en geaudite ERP-noodmodus activeren of stoppen.',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `group` = VALUES(`group`),
  `description` = VALUES(`description`),
  `updatedAt` = VALUES(`updatedAt`);

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT
  'role-permission-salesday-emergency-super-admin',
  'SUPER_ADMIN',
  permission_record.`id`,
  true
FROM `Permission` AS permission_record
WHERE permission_record.`key` = 'salesday.emergencyMode.manage'
ON DUPLICATE KEY UPDATE
  `enabled` = VALUES(`enabled`);
