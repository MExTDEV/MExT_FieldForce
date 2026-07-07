-- MExT FieldForce - STEP9/STEP10 persistence verification
-- Read-only queries. They do not modify or delete data.

-- 1. Main workflow records and user relations.
SELECT
  i.id,
  i.type,
  i.status,
  r.representativeId AS public_representative_id,
  r.email AS representative_email,
  initiator.email AS initiator_email,
  owner.email AS owner_email,
  i.plannedAt,
  i.createdAt,
  i.updatedAt
FROM `Intervention` i
JOIN `User` r ON r.id = i.representativeId
JOIN `User` initiator ON initiator.id = i.initiatorId
JOIN `User` owner ON owner.id = i.ownerId
WHERE i.id LIKE 'step9-%'
ORDER BY i.id;

-- 2. Contact-moment details.
SELECT
  i.id,
  i.status,
  d.reason,
  d.reportedProblems,
  d.conclusion,
  d.createdAt,
  d.updatedAt
FROM `Intervention` i
JOIN `ContactMomentDetail` d ON d.interventionId = i.id
WHERE i.id LIKE 'step9-%-contact'
ORDER BY i.id;

-- 3. Retraining and sales-training details.
SELECT
  i.id,
  i.type,
  i.status,
  d.theme,
  d.reason,
  d.desiredImprovement,
  d.targetAudience,
  d.kpi,
  d.frameworkPhase,
  d.trainer,
  d.conclusion,
  d.followUpAction,
  d.createdAt,
  d.updatedAt
FROM `Intervention` i
JOIN `TrainingDetail` d ON d.interventionId = i.id
WHERE i.id LIKE 'step9-%'
ORDER BY i.id;

-- 4. Sales-training participants.
SELECT
  tp.interventionId,
  COALESCE(u.representativeId, u.id) AS representative,
  u.email
FROM `TrainingParticipant` tp
JOIN `User` u ON u.id = tp.representativeId
WHERE tp.interventionId LIKE 'step9-%-sales-training'
ORDER BY tp.interventionId, u.email;

-- 5. Coaching focus and score rows.
SELECT
  i.id AS intervention_id,
  f.name AS focus_name,
  s.category,
  s.label,
  s.score,
  s.notApplicable,
  s.previousScore
FROM `Intervention` i
LEFT JOIN `InterventionFocus` link ON link.interventionId = i.id
LEFT JOIN `CoachingFocus` f ON f.id = link.focusId
LEFT JOIN `Score` s ON s.interventionId = i.id
WHERE i.id LIKE 'step9-%-coaching'
ORDER BY i.id, s.category, s.label;

-- 6. Action points created through the coaching flow.
SELECT
  ap.id,
  ap.interventionId,
  COALESCE(r.representativeId, r.id) AS representative,
  owner.email AS owner_email,
  ap.title,
  ap.type,
  ap.status,
  ap.priority,
  ap.dueDate,
  ap.createdAt,
  ap.updatedAt
FROM `ActionPoint` ap
JOIN `User` r ON r.id = ap.representativeId
JOIN `User` owner ON owner.id = ap.ownerId
WHERE ap.interventionId LIKE 'step9-%-coaching'
ORDER BY ap.interventionId;

-- 7. Help requests.
SELECT
  h.id,
  h.subject,
  h.status,
  h.urgency,
  COALESCE(r.representativeId, r.id) AS representative,
  requester.email AS requester_email,
  h.createdAt,
  h.updatedAt
FROM `HelpRequest` h
JOIN `User` r ON r.id = h.representativeId
JOIN `User` requester ON requester.id = h.requesterId
WHERE h.subject LIKE 'STEP9%'
ORDER BY h.createdAt;

-- 8. Personal criteria and team relation.
SELECT
  pc.id,
  pc.title,
  pc.focusName,
  pc.active,
  COALESCE(r.representativeId, r.id) AS representative,
  creator.email AS created_by,
  t.name AS team,
  pc.createdAt,
  pc.updatedAt
FROM `PersonalCoachingCriterion` pc
JOIN `User` r ON r.id = pc.representativeId
JOIN `User` creator ON creator.id = pc.createdByUserId
JOIN `Team` t ON t.id = pc.teamId
WHERE pc.id LIKE 'step9-%'
ORDER BY pc.id;

-- 9. Audit trail for all STEP9 entities, including random help-request IDs.
SELECT
  a.id,
  a.entityType,
  a.entityId,
  a.action,
  u.email AS actor_email,
  a.createdAt
FROM `AuditLog` a
JOIN `User` u ON u.id = a.userId
WHERE
  a.entityId LIKE 'step9-%'
  OR a.entityId IN (
    SELECT h.id
    FROM `HelpRequest` h
    WHERE h.subject LIKE 'STEP9%'
  )
ORDER BY a.createdAt;

-- 10. Summary counts. Expected with the two retained STEP9 runs:
-- interventions=8, help_requests=2, personal_criteria=2,
-- coaching_action_points=2, audit_rows=24.
SELECT
  (SELECT COUNT(*) FROM `Intervention` WHERE id LIKE 'step9-%') AS interventions,
  (SELECT COUNT(*) FROM `HelpRequest` WHERE subject LIKE 'STEP9%') AS help_requests,
  (SELECT COUNT(*) FROM `PersonalCoachingCriterion` WHERE id LIKE 'step9-%') AS personal_criteria,
  (
    SELECT COUNT(*)
    FROM `ActionPoint`
    WHERE interventionId LIKE 'step9-%-coaching'
  ) AS coaching_action_points,
  (
    SELECT COUNT(*)
    FROM `AuditLog`
    WHERE
      entityId LIKE 'step9-%'
      OR entityId IN (
        SELECT h.id
        FROM `HelpRequest` h
        WHERE h.subject LIKE 'STEP9%'
      )
  ) AS audit_rows;
