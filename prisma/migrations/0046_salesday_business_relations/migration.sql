CREATE TABLE `BusinessRelation` (
  `id` VARCHAR(191) NOT NULL,
  `type` ENUM('CUSTOMER', 'PROSPECT') NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  `legalName` VARCHAR(191) NOT NULL,
  `displayName` VARCHAR(191) NOT NULL,
  `vatNumber` VARCHAR(191) NULL,
  `preferredLanguage` ENUM('nl', 'fr', 'de') NOT NULL DEFAULT 'nl',
  `country` ENUM('BE', 'NL', 'DE') NOT NULL,
  `ownerUserId` VARCHAR(191) NULL,
  `teamId` VARCHAR(191) NULL,
  `representativeExternalId` VARCHAR(191) NULL,
  `teamExternalId` VARCHAR(191) NULL,
  `isDemo` BOOLEAN NOT NULL DEFAULT false,
  `localRevision` INTEGER NOT NULL DEFAULT 0,
  `pendingFieldForceEdit` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `BusinessRelation_country_status_idx` (`country`, `status`),
  INDEX `BusinessRelation_ownerUserId_status_idx` (`ownerUserId`, `status`),
  INDEX `BusinessRelation_teamId_status_idx` (`teamId`, `status`),
  INDEX `BusinessRelation_representativeExternalId_status_idx` (`representativeExternalId`, `status`),
  INDEX `BusinessRelation_teamExternalId_status_idx` (`teamExternalId`, `status`),
  INDEX `BusinessRelation_displayName_idx` (`displayName`),
  INDEX `BusinessRelation_vatNumber_idx` (`vatNumber`),
  CONSTRAINT `BusinessRelation_ownerUserId_fkey`
    FOREIGN KEY (`ownerUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `BusinessRelation_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE `BusinessRelationContact` (
  `id` VARCHAR(191) NOT NULL,
  `relationId` VARCHAR(191) NOT NULL,
  `type` ENUM('PERSON', 'DEPARTMENT') NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `mobile` VARCHAR(191) NULL,
  `primary` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sourceExternalId` VARCHAR(191) NULL,
  `sourceVersion` VARCHAR(191) NULL,
  `sourceUpdatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BusinessRelationContact_relationId_sourceExternalId_key` (`relationId`, `sourceExternalId`),
  INDEX `BusinessRelationContact_relationId_active_primary_idx` (`relationId`, `active`, `primary`),
  CONSTRAINT `BusinessRelationContact_relationId_fkey`
    FOREIGN KEY (`relationId`) REFERENCES `BusinessRelation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `BusinessRelationAddress` (
  `id` VARCHAR(191) NOT NULL,
  `relationId` VARCHAR(191) NOT NULL,
  `type` ENUM('LEGAL', 'BILLING', 'DELIVERY', 'VISIT') NOT NULL,
  `street` VARCHAR(191) NOT NULL,
  `houseNumber` VARCHAR(191) NULL,
  `postalCode` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `country` ENUM('BE', 'NL', 'DE') NOT NULL,
  `primary` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sourceExternalId` VARCHAR(191) NULL,
  `sourceVersion` VARCHAR(191) NULL,
  `sourceUpdatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BusinessRelationAddress_relationId_sourceExternalId_key` (`relationId`, `sourceExternalId`),
  INDEX `BusinessRelationAddress_relationId_active_primary_idx` (`relationId`, `active`, `primary`),
  INDEX `BusinessRelationAddress_country_postalCode_idx` (`country`, `postalCode`),
  CONSTRAINT `BusinessRelationAddress_relationId_fkey`
    FOREIGN KEY (`relationId`) REFERENCES `BusinessRelation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `BusinessRelationBillingValidation` (
  `id` VARCHAR(191) NOT NULL,
  `relationId` VARCHAR(191) NOT NULL,
  `status` ENUM('NOT_CHECKED', 'PENDING', 'VALID', 'INVALID') NOT NULL DEFAULT 'NOT_CHECKED',
  `modulo97Valid` BOOLEAN NULL,
  `viesCheckedAt` DATETIME(3) NULL,
  `peppolCheckedAt` DATETIME(3) NULL,
  `officialLegalName` VARCHAR(191) NULL,
  `officialBillingAddressJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BusinessRelationBillingValidation_relationId_key` (`relationId`),
  INDEX `BusinessRelationBillingValidation_status_updatedAt_idx` (`status`, `updatedAt`),
  CONSTRAINT `BusinessRelationBillingValidation_relationId_fkey`
    FOREIGN KEY (`relationId`) REFERENCES `BusinessRelation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `BusinessRelationExternalLink` (
  `id` VARCHAR(191) NOT NULL,
  `relationId` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK', 'BC_NAV', 'ODOO') NOT NULL,
  `externalId` VARCHAR(191) NOT NULL,
  `sourceVersion` VARCHAR(191) NOT NULL,
  `sourceUpdatedAt` DATETIME(3) NOT NULL,
  `lastSyncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BusinessRelationExternalLink_provider_externalId_key` (`provider`, `externalId`),
  UNIQUE INDEX `BusinessRelationExternalLink_relationId_provider_key` (`relationId`, `provider`),
  INDEX `BusinessRelationExternalLink_relationId_idx` (`relationId`),
  INDEX `BusinessRelationExternalLink_provider_sourceUpdatedAt_idx` (`provider`, `sourceUpdatedAt`),
  CONSTRAINT `BusinessRelationExternalLink_relationId_fkey`
    FOREIGN KEY (`relationId`) REFERENCES `BusinessRelation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE `ContractCustomer`
  ADD COLUMN `businessRelationId` VARCHAR(191) NULL;

INSERT INTO `BusinessRelation` (
  `id`, `type`, `status`, `legalName`, `displayName`, `vatNumber`, `preferredLanguage`,
  `country`, `ownerUserId`, `teamId`, `representativeExternalId`, `teamExternalId`,
  `isDemo`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('salesday-contract-', customer.`id`),
  'CUSTOMER',
  'ACTIVE',
  customer.`companyName`,
  customer.`companyName`,
  customer.`vatNumber`,
  customer.`preferredLanguage`,
  customer.`countrySnapshot`,
  customer.`ownerUserId`,
  customer.`teamIdSnapshot`,
  COALESCE(owner.`representativeId`, owner.`id`),
  customer.`teamIdSnapshot`,
  customer.`isDemo`,
  customer.`createdAt`,
  customer.`updatedAt`
FROM `ContractCustomer` AS customer
LEFT JOIN `User` AS owner ON owner.`id` = customer.`ownerUserId`;

INSERT INTO `BusinessRelationContact` (
  `id`, `relationId`, `type`, `name`, `email`, `phone`, `primary`, `active`,
  `sourceExternalId`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('salesday-contract-contact-', customer.`id`),
  CONCAT('salesday-contract-', customer.`id`),
  'PERSON',
  COALESCE(NULLIF(customer.`contactName`, ''), customer.`companyName`),
  customer.`email`,
  customer.`phone`,
  true,
  true,
  CONCAT('contract:', customer.`id`, ':primary-contact'),
  customer.`createdAt`,
  customer.`updatedAt`
FROM `ContractCustomer` AS customer
WHERE customer.`contactName` IS NOT NULL OR customer.`email` IS NOT NULL OR customer.`phone` IS NOT NULL;

INSERT INTO `BusinessRelationAddress` (
  `id`, `relationId`, `type`, `street`, `houseNumber`, `postalCode`, `city`, `country`,
  `primary`, `active`, `sourceExternalId`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('salesday-contract-address-', customer.`id`),
  CONCAT('salesday-contract-', customer.`id`),
  'LEGAL',
  COALESCE(NULLIF(customer.`street`, ''), NULLIF(customer.`address`, ''), ''),
  customer.`houseNumber`,
  COALESCE(customer.`postalCode`, ''),
  COALESCE(customer.`city`, ''),
  customer.`countryCode`,
  true,
  true,
  CONCAT('contract:', customer.`id`, ':primary-address'),
  customer.`createdAt`,
  customer.`updatedAt`
FROM `ContractCustomer` AS customer
WHERE customer.`address` IS NOT NULL OR customer.`street` IS NOT NULL OR customer.`postalCode` IS NOT NULL OR customer.`city` IS NOT NULL;

INSERT INTO `BusinessRelationBillingValidation` (
  `id`, `relationId`, `status`, `createdAt`, `updatedAt`
)
SELECT
  CONCAT('salesday-contract-billing-', customer.`id`),
  CONCAT('salesday-contract-', customer.`id`),
  'NOT_CHECKED',
  customer.`createdAt`,
  customer.`updatedAt`
FROM `ContractCustomer` AS customer;

UPDATE `ContractCustomer`
SET `businessRelationId` = CONCAT('salesday-contract-', `id`);

CREATE UNIQUE INDEX `ContractCustomer_businessRelationId_key`
  ON `ContractCustomer`(`businessRelationId`);

ALTER TABLE `ContractCustomer`
  ADD CONSTRAINT `ContractCustomer_businessRelationId_fkey`
  FOREIGN KEY (`businessRelationId`) REFERENCES `BusinessRelation`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
