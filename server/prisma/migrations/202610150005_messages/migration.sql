CREATE TABLE messages (
  id varchar(30) NOT NULL, sender_id varchar(30) NOT NULL, recipient_id varchar(30) NOT NULL,
  subject varchar(300) NOT NULL, body text NOT NULL, read_at datetime(3) NULL,
  created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY(id), KEY messages_recipient_created_at_idx(recipient_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
