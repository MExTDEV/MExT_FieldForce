CREATE INDEX `KpiSnapshot_userId_periodEnd_idx` ON `KpiSnapshot`(`userId`, `periodEnd`);
CREATE INDEX `KpiSnapshot_periodStart_periodEnd_idx` ON `KpiSnapshot`(`periodStart`, `periodEnd`);

CREATE INDEX `Intervention_type_status_country_updatedAt_idx` ON `Intervention`(`type`, `status`, `country`, `updatedAt`);
CREATE INDEX `Intervention_plannedAt_idx` ON `Intervention`(`plannedAt`);

CREATE INDEX `ActionPoint_status_dueDate_idx` ON `ActionPoint`(`status`, `dueDate`);
CREATE INDEX `ActionPoint_representativeId_updatedAt_idx` ON `ActionPoint`(`representativeId`, `updatedAt`);
