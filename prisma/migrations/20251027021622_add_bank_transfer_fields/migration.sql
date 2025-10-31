-- AlterTable
ALTER TABLE `registrations` ADD COLUMN `bank_transfer_proof` VARCHAR(191) NULL,
    ADD COLUMN `bank_transfer_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `payment_method` VARCHAR(191) NULL;
