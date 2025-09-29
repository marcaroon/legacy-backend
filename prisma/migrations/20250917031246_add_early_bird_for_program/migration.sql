-- AlterTable
ALTER TABLE `programs` ADD COLUMN `early_bird_end_date` DATETIME(3) NULL,
    ADD COLUMN `early_bird_price` INTEGER NULL,
    ADD COLUMN `features` JSON NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `is_popular` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `subtitle` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `registrations` ADD COLUMN `used_early_bird` BOOLEAN NOT NULL DEFAULT false;
