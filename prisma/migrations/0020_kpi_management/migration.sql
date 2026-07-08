CREATE TABLE `kpi_categories` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `kpi_categories_code_key`(`code`),
  INDEX `kpi_categories_is_active_sort_order_idx`(`is_active`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kpi_types` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `value_type` ENUM('NUMBER', 'DECIMAL', 'CURRENCY', 'BOOLEAN', 'SCORE') NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `kpi_types_code_key`(`code`),
  INDEX `kpi_types_is_active_sort_order_idx`(`is_active`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `kpi_target_types` (
  `id` VARCHAR(191) NOT NULL,
  `code` ENUM('GLOBAL', 'COUNTRY', 'TEAM', 'USER', 'ROLE') NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `kpi_target_types_code_key`(`code`),
  INDEX `kpi_target_types_is_active_sort_order_idx`(`is_active`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KpiTargetOverride`
  MODIFY `scope` ENUM('GLOBAL', 'COUNTRY', 'TEAM', 'USER', 'ROLE') NOT NULL;

ALTER TABLE `KpiDefinition`
  ADD COLUMN `category_id` VARCHAR(191) NULL,
  ADD COLUMN `type_id` VARCHAR(191) NULL,
  ADD COLUMN `target_type_id` VARCHAR(191) NULL,
  ADD COLUMN `target_team_id` VARCHAR(191) NULL,
  ADD COLUMN `target_user_id` VARCHAR(191) NULL,
  ADD COLUMN `target_role` ENUM('REPRESENTATIVE', 'SALES_LEADER', 'SALES_MANAGER', 'SERVICE_OPERATOR', 'COUNTRY_MANAGER', 'GROUP_MANAGER', 'ADMIN', 'SUPER_ADMIN') NULL,
  ADD COLUMN `weight` DECIMAL(8, 2) NULL,
  ADD COLUMN `counts_for_reporting` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `counts_for_performance_circle` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `valid_from` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `valid_until` DATETIME(3) NULL,
  ADD COLUMN `created_by_user_id` VARCHAR(191) NULL,
  ADD COLUMN `updated_by_user_id` VARCHAR(191) NULL,
  ADD INDEX `KpiDefinition_category_id_idx`(`category_id`),
  ADD INDEX `KpiDefinition_type_id_idx`(`type_id`),
  ADD INDEX `KpiDefinition_target_type_id_idx`(`target_type_id`),
  ADD INDEX `KpiDefinition_country_idx`(`country`),
  ADD INDEX `KpiDefinition_target_team_id_idx`(`target_team_id`),
  ADD INDEX `KpiDefinition_target_user_id_idx`(`target_user_id`),
  ADD INDEX `KpiDefinition_active_sort_order_idx`(`active`, `sort_order`);

CREATE TABLE `kpi_targets` (
  `id` VARCHAR(191) NOT NULL,
  `kpi_definition_id` VARCHAR(191) NOT NULL,
  `target_type_id` VARCHAR(191) NOT NULL,
  `scope` ENUM('GLOBAL', 'COUNTRY', 'TEAM', 'USER', 'ROLE') NOT NULL,
  `scope_key` VARCHAR(191) NOT NULL,
  `country` ENUM('BE', 'NL', 'DE') NULL,
  `team_id` VARCHAR(191) NULL,
  `user_id` VARCHAR(191) NULL,
  `role` ENUM('REPRESENTATIVE', 'SALES_LEADER', 'SALES_MANAGER', 'SERVICE_OPERATOR', 'COUNTRY_MANAGER', 'GROUP_MANAGER', 'ADMIN', 'SUPER_ADMIN') NULL,
  `period_type` ENUM('DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM') NOT NULL,
  `period_start` DATETIME(3) NOT NULL,
  `period_end` DATETIME(3) NOT NULL,
  `target_value` DECIMAL(14, 2) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_by_user_id` VARCHAR(191) NULL,
  `updated_by_user_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `kpi_targets_definition_scope_period_key`(`kpi_definition_id`, `scope_key`, `period_type`, `period_start`, `period_end`),
  INDEX `kpi_targets_definition_active_idx`(`kpi_definition_id`, `active`),
  INDEX `kpi_targets_target_type_id_idx`(`target_type_id`),
  INDEX `kpi_targets_scope_scope_key_idx`(`scope`, `scope_key`),
  INDEX `kpi_targets_country_idx`(`country`),
  INDEX `kpi_targets_team_id_idx`(`team_id`),
  INDEX `kpi_targets_user_id_idx`(`user_id`),
  INDEX `kpi_targets_role_idx`(`role`),
  INDEX `kpi_targets_period_start_period_end_idx`(`period_start`, `period_end`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `KpiDefinition`
  ADD CONSTRAINT `KpiDefinition_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `kpi_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `KpiDefinition_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `kpi_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `KpiDefinition_target_type_id_fkey` FOREIGN KEY (`target_type_id`) REFERENCES `kpi_target_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `KpiDefinition_target_team_id_fkey` FOREIGN KEY (`target_team_id`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `KpiDefinition_target_user_id_fkey` FOREIGN KEY (`target_user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `KpiDefinition_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `KpiDefinition_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `kpi_targets`
  ADD CONSTRAINT `kpi_targets_kpi_definition_id_fkey` FOREIGN KEY (`kpi_definition_id`) REFERENCES `KpiDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `kpi_targets_target_type_id_fkey` FOREIGN KEY (`target_type_id`) REFERENCES `kpi_target_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `kpi_targets_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `kpi_targets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `kpi_targets_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `kpi_targets_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
