-- Keep the Permission basis table aligned with the configurable role rights.
-- Missing Permission rows made role changes fail when saving from /beheer/rollen.

INSERT INTO `Permission` (`id`, `key`, `label`, `group`, `description`, `createdAt`, `updatedAt`) VALUES
  ('perm-0024-action-points-create', 'actionPointsCreate', 'Actiepunten aanmaken', 'Actiepunten', 'Aanmaken en beheren van actiepunten binnen de toegelaten scope.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-action-points-manage', 'actionPointsManage', 'Actiepunten beheren', 'Actiepunten', 'Aanmaken en beheren van actiepunten binnen de toegelaten scope.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-kpis-view', 'kpisView', 'KPI''s bekijken', 'KPI-beheer', 'KPI-definities, doelwaarden en categorieën binnen de toegelaten scope.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-kpis-create', 'kpisCreate', 'KPI''s aanmaken', 'KPI-beheer', 'KPI-definities, doelwaarden en categorieën binnen de toegelaten scope.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-kpis-manage', 'kpisManage', 'KPI''s beheren', 'KPI-beheer', 'KPI-definities, doelwaarden en categorieën binnen de toegelaten scope.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-kpi-targets-manage', 'kpiTargetsManage', 'KPI-doelwaarden beheren', 'KPI-beheer', 'KPI-definities, doelwaarden en categorieën binnen de toegelaten scope.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-kpi-categories-manage', 'kpiCategoriesManage', 'KPI-categorieën beheren', 'KPI-beheer', 'KPI-definities, doelwaarden en categorieën binnen de toegelaten scope.', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-contacts', 'menu.coaching.contacts', 'Contactmomenten', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-retrainings', 'menu.coaching.retrainings', 'Retrainingen', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-trainings', 'menu.coaching.trainings', 'Sales trainingen', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-help', 'menu.coaching.help', 'Hulpaanvragen', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-teams', 'menu.coaching.teams', 'Teams', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-kpis', 'menu.coaching.kpis', 'KPI''s', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-framework', 'menu.coaching.framework', 'Kapstok', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-settings', 'menu.coaching.settings', 'Instellingen', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('perm-0024-menu-coaching-log', 'menu.coaching.log', 'Log', 'Coaching', 'Mega-menu voor Coaching', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `group` = VALUES(`group`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);
