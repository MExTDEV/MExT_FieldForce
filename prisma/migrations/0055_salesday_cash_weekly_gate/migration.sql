CREATE TABLE `SalesPaymentMethod` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK', 'BC_NAV', 'ODOO') NOT NULL,
  `externalId` VARCHAR(191) NOT NULL,
  `sourceVersion` VARCHAR(191) NOT NULL,
  `sourceUpdatedAt` DATETIME(3) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `labelNl` VARCHAR(191) NOT NULL,
  `labelFr` VARCHAR(191) NOT NULL,
  `labelDe` VARCHAR(191) NOT NULL,
  `country` ENUM('BE', 'NL', 'DE') NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `requiresComment` BOOLEAN NOT NULL DEFAULT false,
  `affectsCashBalance` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesPaymentMethod_provider_externalId_key` (`provider`, `externalId`),
  INDEX `SalesPaymentMethod_country_active_code_idx` (`country`, `active`, `code`),
  INDEX `SalesPaymentMethod_affectsCashBalance_idx` (`affectsCashBalance`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SalesCashBalance` (
  `id` VARCHAR(191) NOT NULL,
  `provider` ENUM('MOCK', 'BC_NAV', 'ODOO') NOT NULL,
  `externalId` VARCHAR(191) NOT NULL,
  `sourceVersion` VARCHAR(191) NOT NULL,
  `sourceUpdatedAt` DATETIME(3) NOT NULL,
  `representativeUserId` VARCHAR(191) NOT NULL,
  `representativeExternalId` VARCHAR(191) NOT NULL,
  `country` ENUM('BE', 'NL', 'DE') NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `confirmedBalance` DECIMAL(16,4) NOT NULL,
  `lastDepositConfirmedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesCashBalance_provider_externalId_key` (`provider`, `externalId`),
  UNIQUE INDEX `SalesCashBalance_provider_representativeExternalId_currency_key` (`provider`, `representativeExternalId`, `currency`),
  INDEX `SalesCashBalance_representativeUserId_currency_idx` (`representativeUserId`, `currency`),
  INDEX `SalesCashBalance_country_currency_idx` (`country`, `currency`),
  CONSTRAINT `SalesCashBalance_representativeUserId_fkey` FOREIGN KEY (`representativeUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SalesCashEntry` (
  `id` VARCHAR(191) NOT NULL,
  `entryKey` VARCHAR(191) NOT NULL,
  `type` ENUM('DOCUMENT_CASH_PAYMENT', 'ERP_DEPOSIT_CONFIRMATION', 'ERP_CORRECTION') NOT NULL,
  `provider` ENUM('MOCK', 'BC_NAV', 'ODOO') NULL,
  `representativeUserId` VARCHAR(191) NOT NULL,
  `cashBalanceId` VARCHAR(191) NULL,
  `salesDocumentId` VARCHAR(191) NULL,
  `paymentMethodId` VARCHAR(191) NULL,
  `country` ENUM('BE', 'NL', 'DE') NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `businessDate` DATE NULL,
  `occurredAt` DATETIME(3) NOT NULL,
  `amount` DECIMAL(16,4) NOT NULL,
  `balanceAfter` DECIMAL(16,4) NULL,
  `externalId` VARCHAR(191) NULL,
  `sourceVersion` VARCHAR(191) NULL,
  `commandId` VARCHAR(191) NULL,
  `comment` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SalesCashEntry_entryKey_key` (`entryKey`),
  UNIQUE INDEX `SalesCashEntry_salesDocumentId_key` (`salesDocumentId`),
  INDEX `SalesCashEntry_representativeUserId_businessDate_idx` (`representativeUserId`, `businessDate`),
  INDEX `SalesCashEntry_country_occurredAt_idx` (`country`, `occurredAt`),
  INDEX `SalesCashEntry_cashBalanceId_occurredAt_idx` (`cashBalanceId`, `occurredAt`),
  INDEX `SalesCashEntry_provider_externalId_idx` (`provider`, `externalId`),
  CONSTRAINT `SalesCashEntry_representativeUserId_fkey` FOREIGN KEY (`representativeUserId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesCashEntry_cashBalanceId_fkey` FOREIGN KEY (`cashBalanceId`) REFERENCES `SalesCashBalance` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesCashEntry_salesDocumentId_fkey` FOREIGN KEY (`salesDocumentId`) REFERENCES `SalesDocument` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SalesCashEntry_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `SalesPaymentMethod` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SalesDocument`
  ADD COLUMN `paymentMethodId` VARCHAR(191) NULL,
  ADD COLUMN `paymentMethodExternalId` VARCHAR(191) NULL;

CREATE INDEX `SalesDocument_paymentMethodExternalId_idx` ON `SalesDocument` (`paymentMethodExternalId`);

ALTER TABLE `SalesDocument`
  ADD CONSTRAINT `SalesDocument_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `SalesPaymentMethod` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
