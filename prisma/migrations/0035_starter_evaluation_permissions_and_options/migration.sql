ALTER TABLE `StarterEvaluationQuestion`
  MODIFY COLUMN `answerType` ENUM('SHORT_TEXT','RICH_TEXT','BOOLEAN','NUMBER','PERCENTAGE','CURRENCY','SCORE','CHOICE','MULTI_CHOICE','DATE','SYSTEM','LINKED_CRITERION','ACTION_POINTS') NOT NULL,
  ADD COLUMN IF NOT EXISTS `optionsJson` LONGTEXT NULL;

ALTER TABLE `StarterEvaluationQuestionSnapshot`
  MODIFY COLUMN `answerType` ENUM('SHORT_TEXT','RICH_TEXT','BOOLEAN','NUMBER','PERCENTAGE','CURRENCY','SCORE','CHOICE','MULTI_CHOICE','DATE','SYSTEM','LINKED_CRITERION','ACTION_POINTS') NOT NULL,
  ADD COLUMN IF NOT EXISTS `optionsJson` LONGTEXT NULL;

INSERT INTO `Permission` (`id`, `key`, `label`, `group`, `description`, `createdAt`, `updatedAt`)
VALUES
  (
    'perm-0035-starter-evaluations-execute',
    'starterEvaluationsExecute',
    'Uitvoeren',
    'Tussentijdse evaluatie',
    'Tussentijdse evaluaties uitvoeren binnen de toegestane scope.',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
  ),
  (
    'perm-0035-starter-evaluations-manage',
    'starterEvaluationsManage',
    'Beheer',
    'Tussentijdse evaluatie',
    'Vragen voor tussentijdse evaluaties beheren.',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
  )
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `group` = VALUES(`group`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('rp-0035-starter-eval-execute-', role_seed.`role_name`), role_seed.`role_name`, permission_record.`id`, true
FROM (
  SELECT 'SALES_LEADER' AS `role_name`
  UNION SELECT 'SALES_MANAGER'
  UNION SELECT 'COUNTRY_MANAGER'
  UNION SELECT 'GROUP_MANAGER'
  UNION SELECT 'ADMIN'
  UNION SELECT 'SUPER_ADMIN'
) AS role_seed
JOIN `Permission` AS permission_record
  ON permission_record.`key` = 'starterEvaluationsExecute'
ON DUPLICATE KEY UPDATE `enabled` = `RolePermission`.`enabled`;

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT CONCAT('rp-0035-starter-eval-manage-', role_seed.`role_name`), role_seed.`role_name`, permission_record.`id`, true
FROM (
  SELECT 'SALES_MANAGER' AS `role_name`
  UNION SELECT 'COUNTRY_MANAGER'
  UNION SELECT 'GROUP_MANAGER'
  UNION SELECT 'ADMIN'
  UNION SELECT 'SUPER_ADMIN'
) AS role_seed
JOIN `Permission` AS permission_record
  ON permission_record.`key` = 'starterEvaluationsManage'
ON DUPLICATE KEY UPDATE `enabled` = `RolePermission`.`enabled`;
