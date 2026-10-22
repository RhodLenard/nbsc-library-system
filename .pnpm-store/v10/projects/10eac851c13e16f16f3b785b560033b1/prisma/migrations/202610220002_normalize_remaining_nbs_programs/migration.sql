-- Normalize remaining descriptive NBS College program labels.
-- Accounting Information Systems is kept distinct from Accountancy.
UPDATE `members`
SET `program` = CASE LOWER(TRIM(`program`))
  WHEN 'accounting information system' THEN 'BSAIS'
  WHEN 'accounting information systems' THEN 'BSAIS'
  WHEN 'ais' THEN 'BSAIS'
  WHEN 'computer science' THEN 'BSCS'
  WHEN 'entrep' THEN 'BSE'
  ELSE `program`
END
WHERE LOWER(TRIM(`program`)) IN ('accounting information system', 'accounting information systems', 'ais', 'computer science', 'entrep');

UPDATE `book_titles`
SET `program` = CASE LOWER(TRIM(`program`))
  WHEN 'accounting information system' THEN 'BSAIS'
  WHEN 'accounting information systems' THEN 'BSAIS'
  WHEN 'ais' THEN 'BSAIS'
  WHEN 'computer science' THEN 'BSCS'
  WHEN 'entrep' THEN 'BSE'
  ELSE `program`
END
WHERE LOWER(TRIM(`program`)) IN ('accounting information system', 'accounting information systems', 'ais', 'computer science', 'entrep');
