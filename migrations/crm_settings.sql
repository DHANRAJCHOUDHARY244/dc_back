-- CRM settings table (run if DB_SYNC_ON_START is not enabled)
CREATE TABLE IF NOT EXISTS `crm_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `company_name` VARCHAR(255) NOT NULL DEFAULT 'Som''s Energy Pty Ltd',
  `company_name_short` VARCHAR(255) DEFAULT 'Som''s Energy',
  `abn` VARCHAR(64) DEFAULT NULL,
  `arn_number` VARCHAR(64) DEFAULT NULL,
  `mobile` VARCHAR(32) DEFAULT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `support_email` VARCHAR(255) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `logo_url` VARCHAR(512) DEFAULT NULL,
  `watermark_logo_url` VARCHAR(512) DEFAULT NULL,
  `favicon_url` VARCHAR(512) DEFAULT NULL,
  `quote_logo_url` VARCHAR(512) DEFAULT NULL,
  `invoice_logo_url` VARCHAR(512) DEFAULT NULL,
  `company_signature_url` VARCHAR(512) DEFAULT NULL,
  `email_logo_url` VARCHAR(512) DEFAULT NULL,
  `website` VARCHAR(512) DEFAULT NULL,
  `website_display` VARCHAR(255) DEFAULT NULL,
  `refer_friend_url` VARCHAR(512) DEFAULT NULL,
  `contact_us_url` VARCHAR(512) DEFAULT NULL,
  `metadata_fields` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add document branding image columns (safe to re-run)
ALTER TABLE `crm_settings` ADD COLUMN IF NOT EXISTS `favicon_url` VARCHAR(512) DEFAULT NULL;
ALTER TABLE `crm_settings` ADD COLUMN IF NOT EXISTS `quote_logo_url` VARCHAR(512) DEFAULT NULL;
ALTER TABLE `crm_settings` ADD COLUMN IF NOT EXISTS `invoice_logo_url` VARCHAR(512) DEFAULT NULL;
ALTER TABLE `crm_settings` ADD COLUMN IF NOT EXISTS `company_signature_url` VARCHAR(512) DEFAULT NULL;
ALTER TABLE `crm_settings` ADD COLUMN IF NOT EXISTS `email_logo_url` VARCHAR(512) DEFAULT NULL;
