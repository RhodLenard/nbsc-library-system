-- Legacy contributor IDs are scoped to their source table. The numeric ID 1
-- in `contributors` and `corporate_contributors` represents different rows.
ALTER TABLE title_contributors
  DROP INDEX title_contributors_legacy_id_key,
  ADD COLUMN legacy_source_table varchar(100) NOT NULL DEFAULT 'legacy_unknown' AFTER legacy_id,
  ADD UNIQUE KEY title_contributors_source_legacy_id_key (legacy_source_table, legacy_id);
