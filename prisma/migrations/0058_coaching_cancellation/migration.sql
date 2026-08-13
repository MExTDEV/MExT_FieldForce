ALTER TABLE `Intervention`
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `cancelledById` VARCHAR(191) NULL,
  ADD COLUMN `cancellationReason` TEXT NULL,
  ADD COLUMN `cancelledPreviousStatus` ENUM('CONCEPT','GEPLAND','IN_UITVOERING','WACHT_OP_VT_INPUT','WACHT_OP_VT','WACHT_OP_AKKOORD','GEFINALISEERD','AFGESLOTEN','GESLOTEN','VOLTOOID','VERZONDEN_TER_AKKOORD','AKKOORD_DOOR_VERTEGENWOORDIGER','GEANNULEERD','NIET_UITGEVOERD') NULL,
  ADD COLUMN `calendarCancellationPending` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `calendarCancellationError` TEXT NULL,
  ADD COLUMN `notificationRecipientIdsJson` LONGTEXT NULL;

ALTER TABLE `NotificationDelivery`
  ADD COLUMN `message` TEXT NULL;

CREATE INDEX `Intervention_calendarCancellationPending_idx` ON `Intervention`(`calendarCancellationPending`);
