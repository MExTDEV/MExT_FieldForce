CREATE TABLE `action_point_target_types` (
  `id` VARCHAR(191) NOT NULL,
  `code` ENUM('GLOBAL','COUNTRY','TEAM','USER') NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `action_point_target_types_code_key`(`code`),
  INDEX `action_point_target_types_is_active_sort_order_idx`(`is_active`, `sort_order`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `action_point_target_types`
  (`id`, `code`, `name`, `description`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
  ('apt_global', 'GLOBAL', 'Globaal', 'Actiepunt voor alle relevante gebruikers.', true, 10, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('apt_country', 'COUNTRY', 'Land', 'Actiepunt voor gebruikers binnen een land.', true, 20, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('apt_team', 'TEAM', 'Team', 'Actiepunt voor gebruikers binnen een team.', true, 30, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('apt_user', 'USER', 'Gebruiker', 'Actiepunt voor een individuele gebruiker.', true, 40, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

ALTER TABLE `ActionDefinition`
  ADD COLUMN `target_type_id` VARCHAR(191) NULL;

UPDATE `ActionDefinition`
SET `target_type_id` = CASE `scope`
  WHEN 'GLOBAL' THEN 'apt_global'
  WHEN 'COUNTRY' THEN 'apt_country'
  WHEN 'TEAM' THEN 'apt_team'
  WHEN 'USER' THEN 'apt_user'
  ELSE NULL
END;

CREATE TABLE `action_point_products` (
  `id` VARCHAR(191) NOT NULL,
  `action_point_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `action_point_products_action_point_id_product_id_key`(`action_point_id`, `product_id`),
  INDEX `action_point_products_product_id_idx`(`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ActionDefinition`
  ADD INDEX `ActionDefinition_target_type_id_idx`(`target_type_id`),
  ADD CONSTRAINT `ActionDefinition_target_type_id_fkey` FOREIGN KEY (`target_type_id`) REFERENCES `action_point_target_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `action_point_products`
  ADD CONSTRAINT `action_point_products_action_point_id_fkey` FOREIGN KEY (`action_point_id`) REFERENCES `ActionDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `action_point_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
