ALTER TABLE `DeviceRegistration`
  ADD COLUMN `keyVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `keyFingerprint` CHAR(64) NULL,
  ADD COLUMN `keyProvisionedAt` DATETIME(3) NULL,
  ADD COLUMN `keyRevokedAt` DATETIME(3) NULL,
  ADD COLUMN `deviceTokenHash` CHAR(64) NULL,
  ADD COLUMN `deviceTokenIssuedAt` DATETIME(3) NULL,
  ADD COLUMN `deviceTokenRevokedAt` DATETIME(3) NULL;

ALTER TABLE `DeviceRegistration`
  ADD UNIQUE INDEX `DeviceRegistration_keyFingerprint_key` (`keyFingerprint`),
  ADD UNIQUE INDEX `DeviceRegistration_deviceTokenHash_key` (`deviceTokenHash`);

ALTER TABLE `UserLoginSession`
  ADD COLUMN `deviceRegistrationId` VARCHAR(191) NULL,
  ADD INDEX `UserLoginSession_deviceRegistrationId_logoutAt_idx` (`deviceRegistrationId`, `logoutAt`);

CREATE TABLE `DeviceKeyProvisioningChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `challengeId` VARCHAR(64) NOT NULL,
  `deviceRegistrationId` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `loginSessionId` VARCHAR(191) NULL,
  `targetKeyVersion` INTEGER NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DeviceKeyProvisioningChallenge_challengeId_key` (`challengeId`),
  UNIQUE INDEX `DeviceKeyProvisioningChallenge_tokenHash_key` (`tokenHash`),
  INDEX `DKPC_device_expiry_idx` (`deviceRegistrationId`, `expiresAt`),
  INDEX `DeviceKeyProvisioningChallenge_loginSessionId_idx` (`loginSessionId`)
);

CREATE TABLE `DeviceControlCommand` (
  `id` VARCHAR(191) NOT NULL,
  `commandId` VARCHAR(64) NOT NULL,
  `deviceRegistrationId` VARCHAR(191) NOT NULL,
  `type` ENUM('LOGOUT','WIPE') NOT NULL,
  `status` ENUM('PENDING','DELIVERED','ACKNOWLEDGED') NOT NULL DEFAULT 'PENDING',
  `pendingKey` VARCHAR(191) NULL,
  `requestedByUserId` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deliveredAt` DATETIME(3) NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DeviceControlCommand_commandId_key` (`commandId`),
  UNIQUE INDEX `DeviceControlCommand_pendingKey_key` (`pendingKey`),
  INDEX `DeviceControlCommand_deviceRegistrationId_status_idx` (`deviceRegistrationId`, `status`),
  INDEX `DeviceControlCommand_requestedByUserId_requestedAt_idx` (`requestedByUserId`, `requestedAt`)
);

ALTER TABLE `UserLoginSession`
  ADD CONSTRAINT `UserLoginSession_deviceRegistrationId_fkey`
    FOREIGN KEY (`deviceRegistrationId`) REFERENCES `DeviceRegistration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DeviceKeyProvisioningChallenge`
  ADD CONSTRAINT `DeviceKeyProvisioningChallenge_deviceRegistrationId_fkey`
    FOREIGN KEY (`deviceRegistrationId`) REFERENCES `DeviceRegistration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DeviceControlCommand`
  ADD CONSTRAINT `DeviceControlCommand_deviceRegistrationId_fkey`
    FOREIGN KEY (`deviceRegistrationId`) REFERENCES `DeviceRegistration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DeviceControlCommand_requestedByUserId_fkey`
    FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
