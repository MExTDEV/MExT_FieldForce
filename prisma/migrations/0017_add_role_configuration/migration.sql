CREATE TABLE `RoleConfiguration` (
  `id` VARCHAR(191) NOT NULL,
  `role` ENUM('REPRESENTATIVE', 'SALES_LEADER', 'SALES_MANAGER', 'SERVICE_OPERATOR', 'COUNTRY_MANAGER', 'GROUP_MANAGER', 'ADMIN', 'SUPER_ADMIN') NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `RoleConfiguration_role_key`(`role`),
  INDEX `RoleConfiguration_active_idx`(`active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `RoleConfiguration` (`id`, `role`, `active`, `createdAt`, `updatedAt`) VALUES
  ('role-config-representative', 'REPRESENTATIVE', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('role-config-sales-leader', 'SALES_LEADER', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('role-config-sales-manager', 'SALES_MANAGER', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('role-config-service-operator', 'SERVICE_OPERATOR', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('role-config-country-manager', 'COUNTRY_MANAGER', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('role-config-group-manager', 'GROUP_MANAGER', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('role-config-admin', 'ADMIN', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('role-config-super-admin', 'SUPER_ADMIN', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `role` = `role`;
