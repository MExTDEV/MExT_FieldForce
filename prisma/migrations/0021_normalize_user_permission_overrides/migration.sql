-- UserPermission stores only explicit deviations from the current role default.
-- Rows equal to RolePermission are redundant snapshots and prevent later role
-- changes from taking effect. Genuine per-user overrides are preserved.
DELETE user_permission
FROM `UserPermission` AS user_permission
INNER JOIN `User` AS app_user
  ON app_user.`id` = user_permission.`userId`
INNER JOIN `RolePermission` AS role_permission
  ON role_permission.`role` = app_user.`role`
  AND role_permission.`permissionId` = user_permission.`permissionId`
WHERE user_permission.`enabled` = role_permission.`enabled`;
