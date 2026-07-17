-- Before explicit empty score selections were supported, every unanswered
-- general and personality question was persisted as NVT. Clear those legacy
-- defaults in reports that can still be edited so the coach must answer every
-- question explicitly. Completed and approval-locked reports remain unchanged.
UPDATE `Score` AS `score_row`
INNER JOIN `Intervention` AS `intervention`
  ON `intervention`.`id` = `score_row`.`interventionId`
SET `score_row`.`notApplicable` = false
WHERE `intervention`.`type` = 'BEGELEIDING'
  AND `intervention`.`status` IN ('CONCEPT', 'GEPLAND', 'IN_UITVOERING')
  AND `score_row`.`category` IN ('Dossier:Algemeen', 'Dossier:Persoonlijkheid')
  AND `score_row`.`score` IS NULL
  AND `score_row`.`notApplicable` = true;
