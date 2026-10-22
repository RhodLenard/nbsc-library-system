# Legacy snapshot mapping

| Legacy table | v2 destination | Preservation |
| --- | --- | --- |
| `users` | `members` or `staff` | `usertype = Staff` becomes staff; otherwise member. Source `id` becomes `legacy_id`; source status is retained in `legacy_status` and mapped separately. |
| `admins` | `staff` | Source `id` becomes `legacy_id`; source status is retained in `legacy_status` and mapped separately. |
| `books` | `book_titles`, `copies` | Each physical row becomes a copy; title/ISBN/edition/program identifies its title. Duplicate accessions retain their original `legacy_accession` and receive a deterministic canonical suffix. |
| `borrowings` | `loans` | Source ID/status and issue/due/return history are retained after member/copy lookup. |
| `reservations` | `reservations` | Source ID/status and reservation lifecycle timestamps are retained after member/copy lookup. |
| `fines` | `fines` | Source ID/status, type, amount, assessment, and payment timestamps are retained after loan lookup. |
| `writers` | `authors` | Source `id` becomes `legacy_id`; first/middle/last name are retained. |
| `publishers`, `publications` | `publishers`, `book_titles` | Publisher and publication year are linked through the source physical-copy row. |
| `contributors`, `corporate_contributors`, `corporates` | `title_contributors`, `corporate_contributors` | Contributor identity is source-scoped, so equal numeric IDs from the two source tables do not collide. |

The importer stages every listed source table and imports normalized records in dependency order. It never connects to the legacy database. Rows with missing required fields or references to deleted source records remain in `legacy_stage_rows` and are recorded in `legacy_import_rejects`; they are never silently discarded.

## Completed snapshot audit (2026-10-15)

The provided snapshot produced 339 members, 12 staff accounts, 3,941 titles, 5,853 copies, 2,205 authors, 852 publishers, 330 corporate contributors, 4,862 title-contributor links, 257 loans, 3 reservations, and 54 fines. The reject report contains legacy orphans and incomplete authority rows, including publications or contributor links that reference book records no longer present in the snapshot.
