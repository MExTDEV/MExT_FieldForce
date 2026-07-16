CREATE TABLE `DeviceRegistration` (
  `id` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(128) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `activeUserKey` VARCHAR(191) NULL,
  `platform` ENUM('WINDOWS','ANDROID') NOT NULL,
  `status` ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `deviceLabel` VARCHAR(191) NULL,
  `operatingSystemVersion` VARCHAR(64) NULL,
  `appVersion` VARCHAR(64) NULL,
  `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` DATETIME(3) NULL,
  `revokedByUserId` VARCHAR(191) NULL,
  `revocationReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DeviceRegistration_deviceId_key` (`deviceId`),
  UNIQUE INDEX `DeviceRegistration_activeUserKey_key` (`activeUserKey`),
  INDEX `DeviceRegistration_userId_status_idx` (`userId`, `status`),
  INDEX `DeviceRegistration_status_lastSeenAt_idx` (`status`, `lastSeenAt`),
  INDEX `DeviceRegistration_revokedByUserId_idx` (`revokedByUserId`)
);

ALTER TABLE `DeviceRegistration`
  ADD CONSTRAINT `DeviceRegistration_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `DeviceRegistration_revokedByUserId_fkey`
    FOREIGN KEY (`revokedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
