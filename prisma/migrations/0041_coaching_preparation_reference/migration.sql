ALTER TABLE `Intervention`
  ADD COLUMN `preparationReferenceCoachingId` VARCHAR(191) NULL;

CREATE INDEX `Intervention_preparationReferenceCoachingId_idx`
  ON `Intervention`(`preparationReferenceCoachingId`);

ALTER TABLE `Intervention`
  ADD CONSTRAINT `Intervention_preparationReferenceCoachingId_fkey`
  FOREIGN KEY (`preparationReferenceCoachingId`) REFERENCES `Intervention`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
