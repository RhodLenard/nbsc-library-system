CREATE TABLE library_visits (
  id varchar(30) NOT NULL, member_id varchar(30) NOT NULL,
  entered_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), exited_at datetime(3) NULL,
  PRIMARY KEY(id), KEY library_visits_member_exited_at_idx(member_id,exited_at), KEY library_visits_entered_at_idx(entered_at),
  CONSTRAINT library_visits_member_id_fkey FOREIGN KEY(member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
