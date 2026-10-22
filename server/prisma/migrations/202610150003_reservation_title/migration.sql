ALTER TABLE reservations ADD COLUMN title_id varchar(30) NULL AFTER member_id;
UPDATE reservations r INNER JOIN copies c ON c.id = r.copy_id SET r.title_id = c.title_id WHERE r.title_id IS NULL;
ALTER TABLE reservations MODIFY title_id varchar(30) NOT NULL;
ALTER TABLE reservations ADD KEY reservations_title_status_idx(title_id, status), ADD CONSTRAINT reservations_title_id_fkey FOREIGN KEY(title_id) REFERENCES book_titles(id);
