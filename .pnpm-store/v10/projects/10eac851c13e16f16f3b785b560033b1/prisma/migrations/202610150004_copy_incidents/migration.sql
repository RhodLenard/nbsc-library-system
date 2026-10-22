CREATE TABLE copy_incidents (
  id varchar(30) NOT NULL, copy_id varchar(30) NOT NULL, member_id varchar(30) NULL,
  type varchar(20) NOT NULL, status varchar(20) NOT NULL DEFAULT 'UNREPLACED',
  reported_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), resolved_at datetime(3) NULL,
  PRIMARY KEY(id), KEY copy_incidents_status_reported_at_idx(status,reported_at), KEY copy_incidents_copy_id_idx(copy_id),
  CONSTRAINT copy_incidents_copy_id_fkey FOREIGN KEY(copy_id) REFERENCES copies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
