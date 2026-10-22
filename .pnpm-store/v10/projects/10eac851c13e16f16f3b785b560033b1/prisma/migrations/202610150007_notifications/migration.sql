CREATE TABLE notifications (
  id varchar(30) NOT NULL, recipient_id varchar(30) NOT NULL, kind varchar(30) NOT NULL,
  text varchar(1000) NOT NULL, read_at datetime(3) NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(id), KEY notifications_recipient_created_at_idx(recipient_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
