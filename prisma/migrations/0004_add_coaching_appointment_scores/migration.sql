CREATE TABLE `CoachingAppointmentScore` (
  `id` VARCHAR(191) NOT NULL,
  `appointmentId` VARCHAR(191) NOT NULL,
  `criterion` VARCHAR(191) NOT NULL,
  `score` INTEGER NULL,
  `notApplicable` BOOLEAN NOT NULL DEFAULT false,
  `comment` TEXT NOT NULL,
  `sortOrder` INTEGER NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CoachingAppointmentScore_appointmentId_criterion_key` (`appointmentId`, `criterion`),
  INDEX `CoachingAppointmentScore_appointmentId_idx` (`appointmentId`),
  CONSTRAINT `CoachingAppointmentScore_appointmentId_fkey`
    FOREIGN KEY (`appointmentId`) REFERENCES `CoachingAppointment`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
