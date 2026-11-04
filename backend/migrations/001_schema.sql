CREATE DATABASE IF NOT EXISTS `arychi_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `arychi_db`;

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `provider` VARCHAR(32) NOT NULL DEFAULT 'discord',
  `username` VARCHAR(128) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `bot_connected` TINYINT(1) NOT NULL DEFAULT 0,
  `session_token` VARCHAR(128) NOT NULL UNIQUE,
  `subscription_expires_at` DATETIME DEFAULT NULL,
  `activated_at` DATETIME DEFAULT NULL,
  `total_months_purchased` INT NOT NULL DEFAULT 0,
  `license_key` VARCHAR(64) DEFAULT NULL,
  `quest_token` TEXT DEFAULT NULL,
  `stream_main_token` TEXT DEFAULT NULL,
  `stream_viewer_token` TEXT DEFAULT NULL,
  `stream_guild_id` VARCHAR(64) DEFAULT NULL,
  `stream_channel_id` VARCHAR(64) DEFAULT NULL,
  `stream_prefix` VARCHAR(16) DEFAULT '$',
  `command_channel_id` VARCHAR(64) DEFAULT NULL,
  `admin_ids` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_accounts_session` (`session_token`),
  INDEX `idx_accounts_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
