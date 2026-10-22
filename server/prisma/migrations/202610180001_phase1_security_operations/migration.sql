CREATE TABLE `role_permissions` (
  `id` VARCHAR(191) NOT NULL,
  `role` VARCHAR(64) NOT NULL,
  `permission` VARCHAR(100) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `role_permissions_role_permission_key`(`role`, `permission`),
  INDEX `role_permissions_role_idx`(`role`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `audit_events` (
  `id` VARCHAR(191) NOT NULL,
  `actor_id` VARCHAR(64) NULL,
  `actor_role` VARCHAR(64) NULL,
  `action` VARCHAR(120) NOT NULL,
  `target_type` VARCHAR(80) NULL,
  `target_id` VARCHAR(255) NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `request_id` VARCHAR(128) NULL,
  `before_data` JSON NULL,
  `after_data` JSON NULL,
  `ip_address` VARCHAR(64) NULL,
  INDEX `audit_events_occurred_at_idx`(`occurred_at`),
  INDEX `audit_events_actor_id_occurred_at_idx`(`actor_id`, `occurred_at`),
  INDEX `audit_events_target_type_target_id_occurred_at_idx`(`target_type`, `target_id`, `occurred_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `backup_runs` (
  `id` VARCHAR(191) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  `verified_at` DATETIME(3) NULL,
  `checksum` CHAR(64) NULL,
  `size_bytes` BIGINT UNSIGNED NULL,
  `file_path` VARCHAR(1000) NULL,
  `error` TEXT NULL,
  `kind` VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC',
  INDEX `backup_runs_status_started_at_idx`(`status`, `started_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE `staff` SET `role` = 'Student Assistant' WHERE `role` = 'Assistant';

INSERT INTO `role_permissions` (`id`, `role`, `permission`) VALUES
  (UUID(), 'Admin', 'STAFF_ALL'),
  (UUID(), 'Librarian', 'STAFF_ALL'),
  (UUID(), 'Student Assistant', 'STAFF_ALL'),
  (UUID(), 'Member', 'MEMBER_SELF');
