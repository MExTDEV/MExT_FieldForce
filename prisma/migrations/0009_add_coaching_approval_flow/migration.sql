ALTER TABLE `Intervention`
  MODIFY `status` ENUM(
    'CONCEPT',
    'GEPLAND',
    'IN_UITVOERING',
    'WACHT_OP_VT_INPUT',
    'WACHT_OP_VT',
    'WACHT_OP_AKKOORD',
    'GEFINALISEERD',
    'AFGESLOTEN',
    'GESLOTEN',
    'VOLTOOID',
    'VERZONDEN_TER_AKKOORD',
    'AKKOORD_DOOR_VERTEGENWOORDIGER',
    'GEANNULEERD'
  ) NOT NULL DEFAULT 'CONCEPT',
  ADD COLUMN `sentForApprovalAt` DATETIME(3) NULL,
  ADD COLUMN `sentForApprovalById` VARCHAR(191) NULL,
  ADD COLUMN `approvedByRepAt` DATETIME(3) NULL,
  ADD COLUMN `approvedByRepId` VARCHAR(191) NULL;

CREATE INDEX `Intervention_status_plannedAt_idx`
  ON `Intervention`(`status`, `plannedAt`);
