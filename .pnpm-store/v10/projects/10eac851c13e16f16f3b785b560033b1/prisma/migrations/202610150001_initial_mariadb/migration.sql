-- MariaDB 11.4 / InnoDB baseline. Prisma cannot declare per-column collations.
-- The deployment provisioner creates library_v2. Keeping that provisioning
-- step outside this migration lets the non-root migration account operate
-- without global CREATE DATABASE permission.

CREATE TABLE members (
  id varchar(30) NOT NULL, legacy_id int NULL, legacy_status varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  school_id varchar(64) NULL, name varchar(300) NOT NULL, email varchar(190) NULL, password_hash varchar(255) NULL,
  program varchar(225) NULL, member_type varchar(100) NULL, phone varchar(100) NULL,
  status enum('ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE', imported_at datetime(3) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at datetime(3) NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY members_legacy_id_key (legacy_id), UNIQUE KEY members_school_id_key (school_id), UNIQUE KEY members_email_key (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE staff LIKE members;
ALTER TABLE staff DROP INDEX members_legacy_id_key, DROP INDEX members_school_id_key, DROP INDEX members_email_key,
  DROP COLUMN school_id, DROP COLUMN program, DROP COLUMN member_type, DROP COLUMN phone,
  ADD COLUMN employee_id varchar(64) NULL AFTER legacy_status, ADD COLUMN role varchar(100) NOT NULL AFTER password_hash,
  ADD UNIQUE KEY staff_legacy_id_key (legacy_id), ADD UNIQUE KEY staff_employee_id_key (employee_id), ADD UNIQUE KEY staff_email_key (email);
ALTER TABLE staff MODIFY status enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE';
CREATE TABLE book_titles (
  id varchar(30) NOT NULL, legacy_key varchar(255) NULL, title varchar(500) NOT NULL, preferred_title varchar(500) NULL,
  isbn varchar(100) NULL, subject_category varchar(100) NULL, program varchar(100) NULL, summary text NULL, contents text NULL,
  publisher_id varchar(30) NULL, publication_year int NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(id), UNIQUE KEY book_titles_legacy_key_key(legacy_key), KEY book_titles_title_idx(title), KEY book_titles_isbn_idx(isbn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE copies (
  id varchar(30) NOT NULL, legacy_id int NULL, legacy_status varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  legacy_accession varchar(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL, accession varchar(64) NOT NULL,
  title_id varchar(30) NOT NULL, copy_number int NULL, call_number varchar(255) NULL, shelf_location varchar(100) NULL,
  status enum('AVAILABLE','ON_LOAN','RESERVED','LOST','DAMAGED','REPLACED','REPAIR') NOT NULL DEFAULT 'AVAILABLE', imported_at datetime(3) NULL,
  PRIMARY KEY(id), UNIQUE KEY copies_legacy_id_key(legacy_id), UNIQUE KEY copies_accession_key(accession), KEY copies_status_shelf_location_idx(status,shelf_location),
  CONSTRAINT copies_title_id_fkey FOREIGN KEY(title_id) REFERENCES book_titles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE loans (
  id varchar(30) NOT NULL, legacy_id int NULL, legacy_status varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  member_id varchar(30) NOT NULL, copy_id varchar(30) NOT NULL, status enum('ACTIVE','RETURNED','LOST') NOT NULL DEFAULT 'ACTIVE',
  issued_at datetime(3) NOT NULL, due_at datetime(3) NOT NULL, returned_at datetime(3) NULL,
  PRIMARY KEY(id), UNIQUE KEY loans_legacy_id_key(legacy_id), KEY loans_member_status_idx(member_id,status), KEY loans_copy_status_idx(copy_id,status),
  CONSTRAINT loans_member_id_fkey FOREIGN KEY(member_id) REFERENCES members(id), CONSTRAINT loans_copy_id_fkey FOREIGN KEY(copy_id) REFERENCES copies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE reservations (
  id varchar(30) NOT NULL, legacy_id int NULL, legacy_status varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  member_id varchar(30) NOT NULL, copy_id varchar(30) NULL, status enum('PENDING','READY','RECEIVED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  reserved_at datetime(3) NOT NULL, ready_at datetime(3) NULL, received_at datetime(3) NULL, cancelled_at datetime(3) NULL,
  PRIMARY KEY(id), UNIQUE KEY reservations_legacy_id_key(legacy_id), KEY reservations_member_status_idx(member_id,status), KEY reservations_copy_status_idx(copy_id,status),
  CONSTRAINT reservations_member_id_fkey FOREIGN KEY(member_id) REFERENCES members(id), CONSTRAINT reservations_copy_id_fkey FOREIGN KEY(copy_id) REFERENCES copies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE fines (
  id varchar(30) NOT NULL, legacy_id int NULL, legacy_status varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  loan_id varchar(30) NOT NULL, amount decimal(12,2) NOT NULL, status enum('UNPAID','PAID','WAIVED') NOT NULL DEFAULT 'UNPAID',
  reason varchar(100) NULL, assessed_at datetime(3) NOT NULL, paid_at datetime(3) NULL,
  PRIMARY KEY(id), UNIQUE KEY fines_legacy_id_key(legacy_id), KEY fines_status_idx(status), CONSTRAINT fines_loan_id_fkey FOREIGN KEY(loan_id) REFERENCES loans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE legacy_status_mappings (id varchar(30) NOT NULL, entity_type varchar(64) NOT NULL, legacy_value varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL, target_value varchar(100) NOT NULL, mapping_version varchar(32) NOT NULL, reason varchar(500) NOT NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id), UNIQUE KEY mapping_unique(entity_type,legacy_value,mapping_version)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE legacy_import_runs (id varchar(30) NOT NULL, source_path varchar(1000) NOT NULL, source_sha256 char(64) NOT NULL, started_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), completed_at datetime(3) NULL, status varchar(32) NOT NULL, PRIMARY KEY(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE legacy_import_rejects (id varchar(30) NOT NULL, run_id varchar(30) NOT NULL, source_table varchar(100) NOT NULL, legacy_id varchar(100) NULL, reason text NOT NULL, payload json NOT NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id), KEY rejects_run_table_idx(run_id,source_table)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE legacy_stage_rows (
  id bigint unsigned NOT NULL AUTO_INCREMENT, run_id varchar(30) NOT NULL, source_table varchar(100) NOT NULL,
  legacy_id varchar(100) NULL, payload json NOT NULL, source_collation varchar(64) NOT NULL DEFAULT 'utf8mb4_general_ci',
  staged_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id), KEY stage_run_table_idx(run_id,source_table)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE idempotency_keys (
  id varchar(30) NOT NULL, principal_id varchar(30) NOT NULL, method varchar(16) NOT NULL, path varchar(255) NOT NULL,
  `key` varchar(255) NOT NULL, request_hash char(64) NOT NULL, response json NOT NULL, status_code int NOT NULL,
  expires_at datetime(3) NOT NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
  UNIQUE KEY idempotency_scope_key(principal_id,method,path,`key`), KEY idempotency_expiry_idx(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
