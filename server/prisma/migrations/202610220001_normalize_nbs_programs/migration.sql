-- Normalize imported program labels to the approved NBS College course codes.
-- Values outside these explicit mappings are preserved for manual review.
UPDATE `members`
SET `program` = CASE LOWER(TRIM(`program`))
  WHEN 'accounting' THEN 'BSA'
  WHEN 'accountancy' THEN 'BSA'
  WHEN 'entrepreneurship' THEN 'BSE'
  WHEN 'tourism management' THEN 'BSTM'
  ELSE `program`
END
WHERE LOWER(TRIM(`program`)) IN ('accounting', 'accountancy', 'entrepreneurship', 'tourism management');

UPDATE `book_titles`
SET `program` = CASE LOWER(TRIM(`program`))
  WHEN 'accounting' THEN 'BSA'
  WHEN 'accountancy' THEN 'BSA'
  WHEN 'entrepreneurship' THEN 'BSE'
  WHEN 'tourism management' THEN 'BSTM'
  ELSE `program`
END
WHERE LOWER(TRIM(`program`)) IN ('accounting', 'accountancy', 'entrepreneurship', 'tourism management');
