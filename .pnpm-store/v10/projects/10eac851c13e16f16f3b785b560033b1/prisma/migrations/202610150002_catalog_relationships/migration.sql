-- Relational catalog tables for data preserved in the legacy snapshot.
-- All canonical fields use the v2 utf8mb4_unicode_ci default collation.

CREATE TABLE authors (
  id varchar(30) NOT NULL,
  legacy_id int NULL,
  first_name varchar(100) NOT NULL,
  middle_initial varchar(100) NULL,
  last_name varchar(100) NOT NULL,
  display_name varchar(300) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY authors_legacy_id_key (legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE publishers (
  id varchar(30) NOT NULL,
  legacy_id int NULL,
  name varchar(255) NOT NULL,
  place varchar(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY publishers_legacy_id_key (legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE corporate_contributors (
  id varchar(30) NOT NULL,
  legacy_id int NULL,
  name varchar(255) NOT NULL,
  type varchar(100) NULL,
  location varchar(255) NULL,
  description text NULL,
  PRIMARY KEY (id),
  UNIQUE KEY corporate_contributors_legacy_id_key (legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE title_contributors (
  id varchar(30) NOT NULL,
  legacy_id int NULL,
  title_id varchar(30) NOT NULL,
  author_id varchar(30) NULL,
  corporate_id varchar(30) NULL,
  role varchar(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY title_contributors_legacy_id_key (legacy_id),
  KEY title_contributors_title_id_idx (title_id),
  KEY title_contributors_author_id_idx (author_id),
  KEY title_contributors_corporate_id_idx (corporate_id),
  CONSTRAINT title_contributors_title_id_fkey FOREIGN KEY (title_id) REFERENCES book_titles(id),
  CONSTRAINT title_contributors_author_id_fkey FOREIGN KEY (author_id) REFERENCES authors(id),
  CONSTRAINT title_contributors_corporate_id_fkey FOREIGN KEY (corporate_id) REFERENCES corporate_contributors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE book_titles
  ADD CONSTRAINT book_titles_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES publishers(id);
