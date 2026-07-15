-- Seed the default starter evaluation question configuration for databases
-- where the schema exists but the runtime seed never populated the questions.
-- The statements are idempotent and keep historical creator/updater fields null.

INSERT INTO `StarterEvaluationSection` (
  `id`,
  `code`,
  `titleNl`,
  `sortOrder`,
  `active`,
  `momentsJson`,
  `createdAt`,
  `updatedAt`
)
VALUES
  ('ses_seed_job_expectations', 'job_expectations', 'Verwachtingen over de nieuwe job', 10, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_employee_topics', 'employee_topics', 'Thema''s van de medewerker', 20, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_personal_workstyle', 'personal_workstyle', 'Persoonlijke werkwijze', 30, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_golden_mext_rules', 'golden_mext_rules', 'Attitude / Golden MExT Rules', 40, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_coat_rack_evolution', 'coat_rack_evolution', 'Evolutie in het gebruik van de Kapstok', 50, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_performance_kpis', 'performance_kpis', 'Evolutie op performancecriteria', 60, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_measure', 'measure', 'Meetlat', 70, 0, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_coaching_count', 'coaching_count', 'Aantal begeleidingen', 80, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_coaching_conclusions', 'coaching_conclusions', 'Conclusies uit begeleidingen', 90, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_action_point_evolution', 'action_point_evolution', 'Evolutie van actiepunten', 100, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_previous_todo_realisation', 'previous_todo_realisation', 'Realisatie vorige todo', 110, 1, '["MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_next_period_todo', 'next_period_todo', 'Todo voor de volgende periode', 120, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_expectation_alignment', 'expectation_alignment', 'Evolutie in lijn met de verwachtingen', 130, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('ses_seed_general_evaluation', 'general_evaluation', 'Algemene evaluatie', 140, 1, '["MONTH_1_5","MONTH_3","MONTH_5"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `titleNl` = VALUES(`titleNl`),
  `sortOrder` = VALUES(`sortOrder`),
  `active` = VALUES(`active`),
  `momentsJson` = VALUES(`momentsJson`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `StarterEvaluationQuestion` (
  `id`,
  `key`,
  `sectionId`,
  `textNl`,
  `sortOrder`,
  `required`,
  `active`,
  `answerType`,
  `assignee`,
  `momentsJson`,
  `scopeType`,
  `scopeKey`,
  `createdAt`,
  `updatedAt`
)
SELECT
  CONCAT('seq_seed_', `seed`.`key`),
  `seed`.`key`,
  `section`.`id`,
  `seed`.`textNl`,
  `seed`.`sortOrder`,
  0,
  1,
  `seed`.`answerType`,
  `seed`.`assignee`,
  `seed`.`momentsJson`,
  'GLOBAL',
  'GLOBAL',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM (
  SELECT 'job_expectations_1' AS `key`, 'job_expectations' AS `sectionCode`, 'Hoe voel je je?' AS `textNl`, 10 AS `sortOrder`, 'RICH_TEXT' AS `answerType`, 'BOTH_SEPARATE' AS `assignee`, '["MONTH_1_5","MONTH_3","MONTH_5"]' AS `momentsJson`
  UNION ALL SELECT 'job_expectations_2', 'job_expectations', 'Doe je het graag?', 20, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'job_expectations_3', 'job_expectations', 'Wat loopt goed?', 30, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'job_expectations_4', 'job_expectations', 'Wat valt minder mee?', 40, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'job_expectations_5', 'job_expectations', 'Waarmee kunnen we ondersteunen?', 50, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'job_expectations_6', 'job_expectations', 'Hoe zie je het verder?', 60, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'employee_topics_open', 'employee_topics', 'Zijn er zaken die je wilt aankaarten?', 10, 'RICH_TEXT', 'REPRESENTATIVE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'personal_workstyle_1', 'personal_workstyle', 'Omgang met klanten', 10, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'personal_workstyle_2', 'personal_workstyle', 'Servicegerichtheid, waaronder klachten en retours', 20, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'personal_workstyle_3', 'personal_workstyle', 'Aan- en afwezigheid', 30, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'personal_workstyle_4', 'personal_workstyle', 'Interactie met collega''s, waaronder TS, CB en VL', 40, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'golden_mext_rules_1', 'golden_mext_rules', 'Stiptheid', 10, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'golden_mext_rules_2', 'golden_mext_rules', 'Persoonlijk voorkomen', 20, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'golden_mext_rules_3', 'golden_mext_rules', 'Correcte communicatie', 30, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'golden_mext_rules_4', 'golden_mext_rules', 'Netheid bestelwagen en rijgedrag', 40, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'golden_mext_rules_5', 'golden_mext_rules', 'Correct voorraadbeheer', 50, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'golden_mext_rules_6', 'golden_mext_rules', 'Demo-koffer net en volledig', 60, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'golden_mext_rules_7', 'golden_mext_rules', 'Correcte en tijdige administratie', 70, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'golden_mext_rules_8', 'golden_mext_rules', 'Agenda respecteren', 80, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'coat_rack_evolution_1', 'coat_rack_evolution', 'Voorbereiding', 10, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'coat_rack_evolution_2', 'coat_rack_evolution', 'Introductie', 20, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'coat_rack_evolution_3', 'coat_rack_evolution', 'Belangstelling', 30, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'coat_rack_evolution_4', 'coat_rack_evolution', 'Demonstratie', 40, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'coat_rack_evolution_5', 'coat_rack_evolution', 'Afsluiten', 50, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'performance_kpis_1', 'performance_kpis', 'Gemiddelde omzet per dag', 10, 'LINKED_CRITERION', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'performance_kpis_2', 'performance_kpis', '70% KV', 20, 'LINKED_CRITERION', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'performance_kpis_3', 'performance_kpis', '40% PV', 30, 'LINKED_CRITERION', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'performance_kpis_4', 'performance_kpis', 'Aantal verkopen per dag', 40, 'LINKED_CRITERION', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'performance_kpis_5', 'performance_kpis', 'Aantal FM regels per verkoop', 50, 'LINKED_CRITERION', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'performance_kpis_6', 'performance_kpis', 'Q verkoop 80%', 60, 'LINKED_CRITERION', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'performance_kpis_7', 'performance_kpis', 'Factuurbedrag per verkoop', 70, 'LINKED_CRITERION', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'performance_kpis_8', 'performance_kpis', '% KT/factuur', 80, 'LINKED_CRITERION', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'coaching_count_total', 'coaching_count', 'Aantal begeleidingen', 10, 'NUMBER', 'SYSTEM', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'coaching_conclusions_summary', 'coaching_conclusions', 'Conclusies uit begeleidingen', 10, 'RICH_TEXT', 'EVALUATOR', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'action_point_evolution_1', 'action_point_evolution', 'Actiepunt 1: Kleurencodes 8,5 pntn', 10, 'RICH_TEXT', 'EVALUATOR', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'action_point_evolution_2', 'action_point_evolution', 'Actiepunt 2: Vergeten producten 8,5 pntn', 20, 'RICH_TEXT', 'EVALUATOR', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'action_point_evolution_3', 'action_point_evolution', 'Actiepunt 3: Misbeh en retours', 30, 'RICH_TEXT', 'EVALUATOR', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'action_point_evolution_4', 'action_point_evolution', 'Actiepunt 4: PV/PGJ 60% en EUR300', 40, 'RICH_TEXT', 'EVALUATOR', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'previous_todo_realisation', 'previous_todo_realisation', 'Zijn de voorgaande werkpunten verbeterd?', 10, 'RICH_TEXT', 'BOTH_SEPARATE', '["MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'next_period_action_points', 'next_period_todo', 'Waar dient er aandacht aan besteed worden?', 10, 'ACTION_POINTS', 'EVALUATOR', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'expectation_alignment_summary', 'expectation_alignment', 'Beschrijf de evolutie in lijn met de verwachtingen.', 10, 'RICH_TEXT', 'EVALUATOR', '["MONTH_1_5","MONTH_3","MONTH_5"]'
  UNION ALL SELECT 'general_evaluation_summary', 'general_evaluation', 'Algemene evaluatie', 10, 'RICH_TEXT', 'EVALUATOR', '["MONTH_1_5","MONTH_3","MONTH_5"]'
) `seed`
JOIN `StarterEvaluationSection` `section` ON `section`.`code` = `seed`.`sectionCode`
ON DUPLICATE KEY UPDATE
  `sectionId` = VALUES(`sectionId`),
  `textNl` = VALUES(`textNl`),
  `sortOrder` = VALUES(`sortOrder`),
  `required` = VALUES(`required`),
  `active` = VALUES(`active`),
  `answerType` = VALUES(`answerType`),
  `assignee` = VALUES(`assignee`),
  `momentsJson` = VALUES(`momentsJson`),
  `scopeType` = VALUES(`scopeType`),
  `scopeKey` = VALUES(`scopeKey`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `StarterEvaluationQuestionScopeLink` (
  `id`,
  `questionId`,
  `scopeType`,
  `scopeKey`,
  `sortOrder`,
  `createdAt`,
  `updatedAt`
)
SELECT
  CONCAT('seqs_seed_', `question`.`key`),
  `question`.`id`,
  `question`.`scopeType`,
  `question`.`scopeKey`,
  `question`.`sortOrder`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `StarterEvaluationQuestion` `question`
WHERE `question`.`key` IN (
  'job_expectations_1',
  'job_expectations_2',
  'job_expectations_3',
  'job_expectations_4',
  'job_expectations_5',
  'job_expectations_6',
  'employee_topics_open',
  'personal_workstyle_1',
  'personal_workstyle_2',
  'personal_workstyle_3',
  'personal_workstyle_4',
  'golden_mext_rules_1',
  'golden_mext_rules_2',
  'golden_mext_rules_3',
  'golden_mext_rules_4',
  'golden_mext_rules_5',
  'golden_mext_rules_6',
  'golden_mext_rules_7',
  'golden_mext_rules_8',
  'coat_rack_evolution_1',
  'coat_rack_evolution_2',
  'coat_rack_evolution_3',
  'coat_rack_evolution_4',
  'coat_rack_evolution_5',
  'performance_kpis_1',
  'performance_kpis_2',
  'performance_kpis_3',
  'performance_kpis_4',
  'performance_kpis_5',
  'performance_kpis_6',
  'performance_kpis_7',
  'performance_kpis_8',
  'coaching_count_total',
  'coaching_conclusions_summary',
  'action_point_evolution_1',
  'action_point_evolution_2',
  'action_point_evolution_3',
  'action_point_evolution_4',
  'previous_todo_realisation',
  'next_period_action_points',
  'expectation_alignment_summary',
  'general_evaluation_summary'
)
ON DUPLICATE KEY UPDATE
  `sortOrder` = VALUES(`sortOrder`),
  `updatedAt` = CURRENT_TIMESTAMP(3);
