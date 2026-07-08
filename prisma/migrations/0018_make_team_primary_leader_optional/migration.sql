-- Make the assigned primary team leader optional.
ALTER TABLE `Team` DROP FOREIGN KEY `Team_primaryLeaderId_fkey`;

ALTER TABLE `Team` MODIFY `primaryLeaderId` VARCHAR(191) NULL;

ALTER TABLE `Team`
  ADD CONSTRAINT `Team_primaryLeaderId_fkey`
  FOREIGN KEY (`primaryLeaderId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
