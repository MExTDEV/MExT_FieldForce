-- Align the persisted Country Manager role default with the approved Coaching
-- behaviour. UserPermission contains only explicit deviations from role
-- defaults; rows equal to the previous stored role value are stale snapshots.

DELETE user_permission
FROM `UserPermission` AS user_permission
INNER JOIN `User` AS app_user
  ON app_user.`id` = user_permission.`userId`
INNER JOIN `Permission` AS permission_record
  ON permission_record.`id` = user_permission.`permissionId`
INNER JOIN `RolePermission` AS role_permission
  ON role_permission.`role` = app_user.`role`
  AND role_permission.`permissionId` = user_permission.`permissionId`
WHERE app_user.`role` = 'COUNTRY_MANAGER'
  AND permission_record.`key` = 'moduleVisitRecord'
  AND user_permission.`enabled` = role_permission.`enabled`;

INSERT INTO `RolePermission` (`id`, `role`, `permissionId`, `enabled`)
SELECT
  'role-perm-0030-country-manager-coaching',
  'COUNTRY_MANAGER',
  permission_record.`id`,
  true
FROM `Permission` AS permission_record
WHERE permission_record.`key` = 'moduleVisitRecord'
ON DUPLICATE KEY UPDATE
  `enabled` = VALUES(`enabled`);
