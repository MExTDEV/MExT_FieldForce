-- Repair environments where StarterEvaluation.moment drifted to NOT NULL.
-- Manual evaluations for non-starter representatives do not always map to a
-- fixed starter milestone, so moment must remain nullable as defined in
-- schema.prisma.

ALTER TABLE `StarterEvaluation`
  MODIFY COLUMN `moment` ENUM('MONTH_1_5','MONTH_3','MONTH_5') NULL;
