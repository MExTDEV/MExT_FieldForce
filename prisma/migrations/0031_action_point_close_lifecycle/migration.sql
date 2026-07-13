-- Add close metadata for concrete ActionPoint rows and per-user ActionPointAssignment rows.
ALTER TABLE `ActionPoint`
  ADD COLUMN `closedAt` DATETIME(3) NULL,
  ADD COLUMN `closedByUserId` VARCHAR(191) NULL;

ALTER TABLE `ActionPointAssignment`
  ADD COLUMN `status` ENUM('OPEN', 'NIEUW', 'IN_UITVOERING', 'AFGEROND', 'BEHAALD', 'NIET_BEHAALD', 'GEANNULEERD') NOT NULL DEFAULT 'OPEN',
  ADD COLUMN `closedAt` DATETIME(3) NULL,
  ADD COLUMN `closedByUserId` VARCHAR(191) NULL;

CREATE INDEX `ActionPoint_closedAt_idx` ON `ActionPoint`(`closedAt`);
CREATE INDEX `ActionPoint_closedByUserId_idx` ON `ActionPoint`(`closedByUserId`);
CREATE INDEX `ActionPointAssignment_status_closedAt_idx` ON `ActionPointAssignment`(`status`, `closedAt`);
CREATE INDEX `ActionPointAssignment_closedByUserId_idx` ON `ActionPointAssignment`(`closedByUserId`);

ALTER TABLE `ActionPoint`
  ADD CONSTRAINT `ActionPoint_closedByUserId_fkey`
  FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ActionPointAssignment`
  ADD CONSTRAINT `ActionPointAssignment_closedByUserId_fkey`
  FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `Permission` (`id`, `key`, `label`, `group`, `description`, `createdAt`, `updatedAt`)
VALUES (
  'perm-0031-action-points-close',
  'actionPointsClose',
  'Actiepunten sluiten',
  'Actiepunten',
  'Openstaande concrete actiepunten afsluiten binnen de toegelaten scope.',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `group` = VALUES(`group`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('roleperm-0031-action-points-close-', `role_name`), `role_name`, `Permission`.`id`, TRUE
FROM (
  SELECT 'SALES_LEADER' AS `role_name`
  UNION ALL SELECT 'GROUP_MANAGER'
  UNION ALL SELECT 'COUNTRY_MANAGER'
  UNION ALL SELECT 'ADMIN'
  UNION ALL SELECT 'SUPER_ADMIN'
) AS `defaults`
JOIN `Permission` ON `Permission`.`key` = 'actionPointsClose'
ON DUPLICATE KEY UPDATE `enabled` = `RolePermission`.`enabled`;
