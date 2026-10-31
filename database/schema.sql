-- ==============================================================================
--                       ARYCHI SUITE - MYSQL / MARIADB SCHEMA
-- ==============================================================================
-- Cơ sở dữ liệu: arychi_db
-- Quản trị viên có thể import trực tiếp vào phpMyAdmin, MySQL Workbench hoặc CLI:
-- mysql -u root -p arychi_db < database/schema.sql
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `arychi_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `arychi_db`;

-- ------------------------------------------------------------------------------
-- 1. BẢNG TÀI KHOẢN (ACCOUNTS / USERS)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 2. BẢNG ĐƠN HÀNG THANH TOÁN (ORDERS: VIETQR / PAYOS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `order_code` BIGINT NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(128) NOT NULL,
  `provider` VARCHAR(32) NOT NULL DEFAULT 'discord',
  `months` INT NOT NULL DEFAULT 1,
  `amount` INT NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `status` ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `vietqr_url` TEXT DEFAULT NULL,
  `bank_id` VARCHAR(64) DEFAULT NULL,
  `bank_name` VARCHAR(128) DEFAULT NULL,
  `account_no` VARCHAR(64) DEFAULT NULL,
  `account_name` VARCHAR(128) DEFAULT NULL,
  `payos_checkout_url` TEXT DEFAULT NULL,
  `payos_payment_link_id` VARCHAR(128) DEFAULT NULL,
  `payos_qr_code` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` DATETIME DEFAULT NULL,
  INDEX `idx_orders_user` (`user_id`),
  INDEX `idx_orders_status` (`status`),
  CONSTRAINT `fk_orders_account` FOREIGN KEY (`user_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. BẢNG LỊCH SỬ GIAO DỊCH (TRANSACTIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `order_code` BIGINT NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `amount` INT NOT NULL,
  `gateway` VARCHAR(32) NOT NULL,
  `reference` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_transactions_user` (`user_id`),
  INDEX `idx_transactions_order` (`order_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
