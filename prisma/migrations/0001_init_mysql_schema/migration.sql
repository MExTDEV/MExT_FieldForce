-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `mobile` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `branchNumber` VARCHAR(191) NULL,
    `entraId` VARCHAR(191) NULL,
    `role` ENUM('REPRESENTATIVE', 'SALES_LEADER', 'SERVICE_OPERATOR', 'COUNTRY_MANAGER', 'GROUP_MANAGER', 'ADMIN', 'SUPER_ADMIN') NOT NULL,
    `country` ENUM('BE', 'NL', 'DE') NOT NULL,
    `language` ENUM('nl', 'fr', 'de') NOT NULL DEFAULT 'nl',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `teamSupervisor` BOOLEAN NOT NULL DEFAULT false,
    `teamId` VARCHAR(191) NULL,
    `levelId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_entraId_key`(`entraId`),
    INDEX `User_country_role_idx`(`country`, `role`),
    INDEX `User_teamId_idx`(`teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Team` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `country` ENUM('BE', 'NL', 'DE') NOT NULL,
    `primaryLeaderId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Team_country_name_key`(`country`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamLeader` (
    `id` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('PRIMARY', 'EXTRA') NOT NULL,

    UNIQUE INDEX `TeamLeader_teamId_userId_key`(`teamId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `group` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('REPRESENTATIVE', 'SALES_LEADER', 'SERVICE_OPERATOR', 'COUNTRY_MANAGER', 'GROUP_MANAGER', 'ADMIN', 'SUPER_ADMIN') NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,

    INDEX `RolePermission_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `RolePermission_role_permissionId_key`(`role`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPermission` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL,

    INDEX `UserPermission_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `UserPermission_userId_permissionId_key`(`userId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Level` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Level_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KpiDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `country` ENUM('BE', 'NL', 'DE') NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `unit` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KpiDefinition_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KpiSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kpiDefinitionId` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `value` DECIMAL(14, 2) NOT NULL,
    `target` DECIMAL(14, 2) NULL,
    `source` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KpiSnapshot_userId_kpiDefinitionId_periodStart_periodEnd_key`(`userId`, `kpiDefinitionId`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Intervention` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('BEGELEIDING', 'CONTACTMOMENT', 'RETRAINING', 'SALES_TRAINING', 'HULPAANVRAAG') NOT NULL,
    `status` ENUM('CONCEPT', 'GEPLAND', 'IN_UITVOERING', 'WACHT_OP_VT_INPUT', 'WACHT_OP_VT', 'WACHT_OP_AKKOORD', 'AFGESLOTEN', 'GEANNULEERD') NOT NULL DEFAULT 'CONCEPT',
    `representativeId` VARCHAR(191) NOT NULL,
    `initiatorId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `country` ENUM('BE', 'NL', 'DE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `plannedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Intervention_representativeId_type_idx`(`representativeId`, `type`),
    INDEX `Intervention_country_status_idx`(`country`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactMomentDetail` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `reportedProblems` TEXT NULL,
    `leaderThemes` LONGTEXT NOT NULL,
    `representativeKpis` LONGTEXT NOT NULL,
    `representativeThemes` LONGTEXT NOT NULL,
    `discussedThemes` LONGTEXT NOT NULL,
    `conclusion` TEXT NULL,
    `sourceHelpRequestId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ContactMomentDetail_interventionId_key`(`interventionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoachingFocus` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoachingFocus_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoachingCriterion` (
    `id` VARCHAR(191) NOT NULL,
    `focusId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoachingCriterion_focusId_name_key`(`focusId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PersonalCoachingCriterion` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `focusId` VARCHAR(191) NULL,
    `focusName` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `country` ENUM('BE', 'NL', 'DE') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PersonalCoachingCriterion_teamId_idx`(`teamId`),
    INDEX `PersonalCoachingCriterion_country_idx`(`country`),
    UNIQUE INDEX `PersonalCoachingCriterion_representativeId_title_active_key`(`representativeId`, `title`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InterventionFocus` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NOT NULL,
    `focusId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `InterventionFocus_interventionId_focusId_key`(`interventionId`, `focusId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InterventionParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,

    INDEX `InterventionParticipant_representativeId_idx`(`representativeId`),
    UNIQUE INDEX `InterventionParticipant_interventionId_representativeId_key`(`interventionId`, `representativeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Score` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NOT NULL,
    `criterionId` VARCHAR(191) NULL,
    `personalCriterionId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `label` VARCHAR(191) NULL,
    `score` INTEGER NULL,
    `notApplicable` BOOLEAN NOT NULL DEFAULT false,
    `comment` TEXT NULL,
    `previousScore` INTEGER NULL,

    INDEX `Score_personalCriterionId_idx`(`personalCriterionId`),
    INDEX `Score_interventionId_category_idx`(`interventionId`, `category`),
    UNIQUE INDEX `Score_interventionId_criterionId_key`(`interventionId`, `criterionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoachingDetail` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NOT NULL,
    `arrivalTime` VARCHAR(191) NULL,
    `departureTime` VARCHAR(191) NULL,
    `kilometers` DECIMAL(14, 2) NULL,
    `area` VARCHAR(191) NULL,
    `sector` VARCHAR(191) NULL,
    `groupAttentionPoints` LONGTEXT NOT NULL,
    `individualAttentionPoint` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CoachingDetail_interventionId_key`(`interventionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoachingAppointment` (
    `id` VARCHAR(191) NOT NULL,
    `coachingDetailId` VARCHAR(191) NOT NULL,
    `customer` VARCHAR(191) NOT NULL,
    `customerNumber` VARCHAR(191) NULL,
    `place` VARCHAR(191) NULL,
    `relationType` VARCHAR(191) NOT NULL,
    `appointmentType` VARCHAR(191) NOT NULL,
    `arrivalTime` VARCHAR(191) NOT NULL,
    `departureTime` VARCHAR(191) NOT NULL,
    `activity` TEXT NOT NULL,
    `scores` LONGTEXT NOT NULL,
    `remarks` TEXT NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CoachingAppointment_coachingDetailId_idx`(`coachingDetailId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,

    INDEX `TrainingParticipant_representativeId_idx`(`representativeId`),
    UNIQUE INDEX `TrainingParticipant_interventionId_representativeId_key`(`interventionId`, `representativeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActionPoint` (
    `id` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `type` ENUM('KPI', 'VAARDIGHEID', 'GEDRAG') NOT NULL,
    `status` ENUM('NIEUW', 'IN_UITVOERING', 'BEHAALD', 'NIET_BEHAALD', 'GEANNULEERD') NOT NULL DEFAULT 'NIEUW',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH') NOT NULL DEFAULT 'NORMAL',
    `kpiDefinitionId` VARCHAR(191) NULL,
    `startValue` DECIMAL(14, 2) NULL,
    `targetValue` DECIMAL(14, 2) NULL,
    `currentValue` DECIMAL(14, 2) NULL,
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ActionPoint_representativeId_status_idx`(`representativeId`, `status`),
    INDEX `ActionPoint_ownerId_idx`(`ownerId`),
    INDEX `ActionPoint_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActionPointAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `actionPointId` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'individual',

    INDEX `ActionPointAssignment_representativeId_idx`(`representativeId`),
    UNIQUE INDEX `ActionPointAssignment_actionPointId_representativeId_key`(`actionPointId`, `representativeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reflection` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,
    `learnedText` VARCHAR(191) NOT NULL,
    `workOnText` VARCHAR(191) NOT NULL,
    `concreteGoalText` VARCHAR(191) NOT NULL,
    `status` ENUM('NIET_GESTART', 'INGEDIEND') NOT NULL DEFAULT 'NIET_GESTART',
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Reflection_interventionId_key`(`interventionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,
    `status` ENUM('GELEZEN_AKKOORD', 'GELEZEN_NIET_AKKOORD') NOT NULL,
    `comment` VARCHAR(191) NULL,
    `openedAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Approval_interventionId_key`(`interventionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HelpRequest` (
    `id` VARCHAR(191) NOT NULL,
    `interventionId` VARCHAR(191) NULL,
    `requesterId` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `difficulty` VARCHAR(191) NOT NULL,
    `desiredResult` VARCHAR(191) NOT NULL,
    `explanation` VARCHAR(191) NULL,
    `urgency` ENUM('LOW', 'NORMAL', 'HIGH') NOT NULL,
    `status` ENUM('NIEUW', 'IN_BEHANDELING', 'VERVOLGACTIE_GEPLAND', 'AFGESLOTEN', 'GEANNULEERD') NOT NULL DEFAULT 'NIEUW',
    `followUpType` ENUM('BEGELEIDING', 'CONTACTMOMENT', 'RETRAINING', 'SALES_TRAINING', 'HULPAANVRAAG') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HelpRequest_interventionId_key`(`interventionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Product_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `representativeId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `purchaseStatus` VARCHAR(191) NOT NULL,
    `afwijkendeHoeveelheid` DECIMAL(14, 2) NULL,
    `lastPurchaseYears` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductAnalysis_representativeId_productId_key`(`representativeId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldValue` LONGTEXT NULL,
    `newValue` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_modules` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `naam` VARCHAR(191) NOT NULL,
    `actief` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `app_modules_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_levelId_fkey` FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Team` ADD CONSTRAINT `Team_primaryLeaderId_fkey` FOREIGN KEY (`primaryLeaderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamLeader` ADD CONSTRAINT `TeamLeader_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamLeader` ADD CONSTRAINT `TeamLeader_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPermission` ADD CONSTRAINT `UserPermission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPermission` ADD CONSTRAINT `UserPermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KpiSnapshot` ADD CONSTRAINT `KpiSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KpiSnapshot` ADD CONSTRAINT `KpiSnapshot_kpiDefinitionId_fkey` FOREIGN KEY (`kpiDefinitionId`) REFERENCES `KpiDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Intervention` ADD CONSTRAINT `Intervention_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Intervention` ADD CONSTRAINT `Intervention_initiatorId_fkey` FOREIGN KEY (`initiatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Intervention` ADD CONSTRAINT `Intervention_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContactMomentDetail` ADD CONSTRAINT `ContactMomentDetail_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoachingCriterion` ADD CONSTRAINT `CoachingCriterion_focusId_fkey` FOREIGN KEY (`focusId`) REFERENCES `CoachingFocus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersonalCoachingCriterion` ADD CONSTRAINT `PersonalCoachingCriterion_focusId_fkey` FOREIGN KEY (`focusId`) REFERENCES `CoachingFocus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersonalCoachingCriterion` ADD CONSTRAINT `PersonalCoachingCriterion_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersonalCoachingCriterion` ADD CONSTRAINT `PersonalCoachingCriterion_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PersonalCoachingCriterion` ADD CONSTRAINT `PersonalCoachingCriterion_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterventionFocus` ADD CONSTRAINT `InterventionFocus_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterventionFocus` ADD CONSTRAINT `InterventionFocus_focusId_fkey` FOREIGN KEY (`focusId`) REFERENCES `CoachingFocus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterventionParticipant` ADD CONSTRAINT `InterventionParticipant_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterventionParticipant` ADD CONSTRAINT `InterventionParticipant_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Score` ADD CONSTRAINT `Score_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Score` ADD CONSTRAINT `Score_criterionId_fkey` FOREIGN KEY (`criterionId`) REFERENCES `CoachingCriterion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Score` ADD CONSTRAINT `Score_personalCriterionId_fkey` FOREIGN KEY (`personalCriterionId`) REFERENCES `PersonalCoachingCriterion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoachingDetail` ADD CONSTRAINT `CoachingDetail_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CoachingAppointment` ADD CONSTRAINT `CoachingAppointment_coachingDetailId_fkey` FOREIGN KEY (`coachingDetailId`) REFERENCES `CoachingDetail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingParticipant` ADD CONSTRAINT `TrainingParticipant_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingParticipant` ADD CONSTRAINT `TrainingParticipant_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionPoint` ADD CONSTRAINT `ActionPoint_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionPoint` ADD CONSTRAINT `ActionPoint_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionPoint` ADD CONSTRAINT `ActionPoint_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionPoint` ADD CONSTRAINT `ActionPoint_kpiDefinitionId_fkey` FOREIGN KEY (`kpiDefinitionId`) REFERENCES `KpiDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionPointAssignment` ADD CONSTRAINT `ActionPointAssignment_actionPointId_fkey` FOREIGN KEY (`actionPointId`) REFERENCES `ActionPoint`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionPointAssignment` ADD CONSTRAINT `ActionPointAssignment_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reflection` ADD CONSTRAINT `Reflection_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reflection` ADD CONSTRAINT `Reflection_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval` ADD CONSTRAINT `Approval_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval` ADD CONSTRAINT `Approval_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HelpRequest` ADD CONSTRAINT `HelpRequest_interventionId_fkey` FOREIGN KEY (`interventionId`) REFERENCES `Intervention`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HelpRequest` ADD CONSTRAINT `HelpRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HelpRequest` ADD CONSTRAINT `HelpRequest_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductAnalysis` ADD CONSTRAINT `ProductAnalysis_representativeId_fkey` FOREIGN KEY (`representativeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductAnalysis` ADD CONSTRAINT `ProductAnalysis_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

