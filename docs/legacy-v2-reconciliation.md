# Legacy SQL -> v2 reconciliation

Generated: 2026-10-15T05:30:47.300Z

## Scope and safeguards

This report was produced by `server/src/reconciliation/reconcile-legacy.ts`. It parses the SQL snapshot and uses Prisma `findMany` reads only; it does not connect to, write to, or alter the legacy database. Its only local change is this report file.

## Snapshot and import verification

- SQL file analysed: `data\legacy-copy\librarysystem.sql`
- SHA-256: `3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0`
- Desktop export: `C:\Users\Rhod\Desktop\librarysystem.sql` — matches this snapshot exactly (latest confirmed)
- Latest recorded v2 import: `librarysystem.sql` (3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0; COMPLETED)
- A completed/import run with this exact hash: yes (COMPLETED, 2026-10-15T05:30:42.193Z)

| Status | Source path | SHA-256 | Started | Completed |
| --- | --- | --- | --- | --- |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-15T05:26:07.927Z | 2026-10-15T05:30:42.193Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-15T04:39:06.759Z | 2026-10-15T04:40:52.954Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-15T04:35:55.069Z | 2026-10-15T04:37:44.460Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-15T04:05:22.021Z | 2026-10-15T04:06:39.644Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-14T19:58:50.779Z | 2026-10-14T20:00:06.514Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-14T19:55:34.688Z | 2026-10-14T19:56:51.238Z |
| ABANDONED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-14T19:51:38.908Z | 2026-10-14T19:55:34.562Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-14T19:30:26.140Z | 2026-10-14T19:30:31.609Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-14T19:28:44.545Z | 2026-10-14T19:30:09.468Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-14T19:27:08.277Z | 2026-10-14T19:54:43.713Z |
| COMPLETED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-14T19:25:03.939Z | 2026-10-14T19:54:43.517Z |
| ABANDONED | librarysystem.sql | 3fee4497d79a3d51b938a513a7a49c7aa8fab246fd021af045ffad3a5d03b5f0 | 2026-10-14T19:15:27.828Z | 2026-10-14T19:27:08.151Z |

## Parser repair

The former importer ended an INSERT statement at the first semicolon it encountered, including semicolons inside quoted text fields. The importer now uses the quote-aware statement parser from this audit, and the v2 legacy-imported rows were rebuilt from the verified snapshot.

| Source table | Rows in SQL (quote-aware) | Rows seen by former importer | Rows formerly lost before validation |
| --- | ---: | ---: | ---: |
| `books` | 6443 | 5857 | 586 |
| `writers` | 3455 | 2232 | 1223 |
| `publishers` | 1889 | 852 | 1037 |
| `users` | 347 | 347 | 0 |
| `borrowings` | 282 | 282 | 0 |
| `reservations` | 3 | 3 | 0 |
| `fines` | 55 | 55 | 0 |

The snapshot contains 6,443 `books` rows: 6,439 valid rows, matching the old catalog screen, plus 4 invalid rows. The repaired import contains all 6,439 valid book copies.

## Import mapping rules

| Legacy source | v2 destination | Match key and transformations |
| --- | --- | --- |
| `books` | `book_titles` + `copies` | One title per `title|ISBN|edition|program`; each valid book becomes a copy matched by `legacy_id`. Required: id, accession, title. |
| `writers` | `authors` | Matched by `writers.id -> authors.legacy_id`. Required: id, first name, last name. |
| `publishers` | `publishers` | Matched by `publishers.id -> publishers.legacy_id`. Required: id and publisher name. |
| non-staff `users` | `members` | Matched by `users.id -> members.legacy_id`. Rows with `usertype=staff` are not members. Required: id and non-empty name. |
| `borrowings` | `loans` | Matched by legacy ID; requires existing mapped member and copy, issue date, and due date. |
| `reservations` | `reservations` | Matched by legacy ID; requires existing mapped member, copy, and reservation date. |
| `fines` | `fines` | Matched by legacy ID; requires existing mapped loan, assessment date, and amount. |

Status values are converted by `mapLegacyStatus`; original values remain in `legacy_status`. SQL `NULL` becomes JavaScript/Prisma `null`. The importer uses `createMany({ skipDuplicates: true })` for bulk records, then retries book copies that collide on accession using `<accession>--legacy-<id>`. It does not update an existing normalized row on re-import.

## Source tables not imported into v2

- `account_deletion_requests`
- `api_idempotency`
- `api_rate_limits`
- `api_sessions`
- `audit_events`
- `cart`
- `device_tokens`
- `library_visits`
- `messages`
- `mobile_web_tickets`
- `notifications`
- `notification_outbox`
- `schema_migrations`
- `updates`
- `verification_challenges`

## Books -> book_titles / copies

| Measure | Count |
| --- | ---: |
| Valid legacy source rows | 6439 |
| v2 rows with a legacy ID | 6439 |
| Missing in v2 | 0 |
| Extra in v2 | 0 |
| Duplicate legacy IDs in source | 0 |
| Field-level mismatches | 18 |
| Skipped by import rules | 4 |

Mismatch samples (up to 10):

```json
[
  {
    "legacyId": "2769",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "Working with Microsoft Office 365: Running your Small Business in the Cloud|9780735658998||BSCS",
        "v2": "Working with Microsoft Office 365: Running Your Small Business in the Cloud|9780735658998||BSCS"
      },
      "title": {
        "legacy": "Working with Microsoft Office 365: Running your Small Business in the Cloud",
        "v2": "Working with Microsoft Office 365: Running Your Small Business in the Cloud"
      }
    }
  },
  {
    "legacyId": "3212",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "Blueprint for your library marketing plan: a guide to help you survive and thrive|9789746522250||BLIS",
        "v2": "Blueprint for your Library Marketing Plan: A Guide to Help You Survive and Thrive|9789746522250||BLIS"
      },
      "title": {
        "legacy": "Blueprint for your library marketing plan: a guide to help you survive and thrive",
        "v2": "Blueprint for your Library Marketing Plan: A Guide to Help You Survive and Thrive"
      }
    }
  },
  {
    "legacyId": "3213",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "Blueprint for your library marketing plan: a guide to help you survive and thrive|9789746522250||BLIS",
        "v2": "Blueprint for your Library Marketing Plan: A Guide to Help You Survive and Thrive|9789746522250||BLIS"
      },
      "title": {
        "legacy": "Blueprint for your library marketing plan: a guide to help you survive and thrive",
        "v2": "Blueprint for your Library Marketing Plan: A Guide to Help You Survive and Thrive"
      }
    }
  },
  {
    "legacyId": "3214",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "Blueprint for your library marketing plan: a guide to help you survive and thrive|9789746522250||BLIS",
        "v2": "Blueprint for your Library Marketing Plan: A Guide to Help You Survive and Thrive|9789746522250||BLIS"
      },
      "title": {
        "legacy": "Blueprint for your library marketing plan: a guide to help you survive and thrive",
        "v2": "Blueprint for your Library Marketing Plan: A Guide to Help You Survive and Thrive"
      }
    }
  },
  {
    "legacyId": "3215",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "Blueprint for your library marketing plan: a guide to help you survive and thrive|9789746522250||BLIS",
        "v2": "Blueprint for your Library Marketing Plan: A Guide to Help You Survive and Thrive|9789746522250||BLIS"
      },
      "title": {
        "legacy": "Blueprint for your library marketing plan: a guide to help you survive and thrive",
        "v2": "Blueprint for your Library Marketing Plan: A Guide to Help You Survive and Thrive"
      }
    }
  },
  {
    "legacyId": "4155",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "Partnerships and corporation (law and application) for business students|9789719919933|2015|BSA/BSAIS",
        "v2": "Partnerships and Corporation (Law and Application) for Business Students|9789719919933|2015|BSA/BSAIS"
      },
      "title": {
        "legacy": "Partnerships and corporation (law and application) for business students",
        "v2": "Partnerships and Corporation (Law and Application) for Business Students"
      }
    }
  },
  {
    "legacyId": "4313",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "Financial Management: comprehensive volume|9786214160648|19-20|BSA/BSAIS",
        "v2": "Financial management: comprehensive volume|9786214160648|19-20|BSA/BSAIS"
      },
      "title": {
        "legacy": "Financial Management: comprehensive volume",
        "v2": "Financial management: comprehensive volume"
      }
    }
  },
  {
    "legacyId": "5234",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "The talisman Unsealed|9789716917062||",
        "v2": "The Talisman Unsealed|9789716917062||"
      },
      "title": {
        "legacy": "The talisman Unsealed",
        "v2": "The Talisman Unsealed"
      }
    }
  },
  {
    "legacyId": "5399",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "Get into Acting|9718563431||",
        "v2": "Get Into Acting|9718563431||"
      },
      "title": {
        "legacy": "Get into Acting",
        "v2": "Get Into Acting"
      }
    }
  },
  {
    "legacyId": "5440",
    "reason": "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).",
    "fields": {
      "legacyKey": {
        "legacy": "A Nation Unborn|9789719362609||",
        "v2": "A nation unborn|9789719362609||"
      },
      "title": {
        "legacy": "A Nation Unborn",
        "v2": "A nation unborn"
      }
    }
  }
]
```

Skipped samples (up to 10):

```json
[
  {
    "legacyId": "5174",
    "reason": "Missing ID, accession number, or title."
  },
  {
    "legacyId": "5302",
    "reason": "Missing ID, accession number, or title."
  },
  {
    "legacyId": "5358",
    "reason": "Missing ID, accession number, or title."
  },
  {
    "legacyId": "5951",
    "reason": "Missing ID, accession number, or title."
  }
]
```

## Authors (writers) -> authors

| Measure | Count |
| --- | ---: |
| Valid legacy source rows | 3395 |
| v2 rows with a legacy ID | 3395 |
| Missing in v2 | 0 |
| Extra in v2 | 0 |
| Duplicate legacy IDs in source | 0 |
| Field-level mismatches | 0 |
| Skipped by import rules | 60 |

Skipped samples (up to 10):

```json
[
  {
    "legacyId": "393",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "435",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "441",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "468",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "537",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "541",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "551",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "571",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "583",
    "reason": "Missing ID, first name, or last name."
  },
  {
    "legacyId": "716",
    "reason": "Missing ID, first name, or last name."
  }
]
```

## Publishers -> publishers

| Measure | Count |
| --- | ---: |
| Valid legacy source rows | 1889 |
| v2 rows with a legacy ID | 1889 |
| Missing in v2 | 0 |
| Extra in v2 | 0 |
| Duplicate legacy IDs in source | 0 |
| Field-level mismatches | 0 |
| Skipped by import rules | 0 |

## Members (non-staff users) -> members

| Measure | Count |
| --- | ---: |
| Valid legacy source rows | 339 |
| v2 rows with a legacy ID | 339 |
| Missing in v2 | 0 |
| Extra in v2 | 0 |
| Duplicate legacy IDs in source | 0 |
| Field-level mismatches | 0 |
| Skipped by import rules | 0 |

## Loans (borrowings) -> loans

| Measure | Count |
| --- | ---: |
| Valid legacy source rows | 271 |
| v2 rows with a legacy ID | 271 |
| Missing in v2 | 0 |
| Extra in v2 | 0 |
| Duplicate legacy IDs in source | 0 |
| Field-level mismatches | 0 |
| Skipped by import rules | 11 |

Skipped samples (up to 10):

```json
[
  {
    "legacyId": "71",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "72",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "73",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "74",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "75",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "78",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "79",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "80",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "81",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  },
  {
    "legacyId": "82",
    "reason": "Missing ID, mapped member/copy, issue date, or due date."
  }
]
```

## Reservations -> reservations

| Measure | Count |
| --- | ---: |
| Valid legacy source rows | 3 |
| v2 rows with a legacy ID | 3 |
| Missing in v2 | 0 |
| Extra in v2 | 0 |
| Duplicate legacy IDs in source | 0 |
| Field-level mismatches | 0 |
| Skipped by import rules | 0 |

## Fines -> fines

| Measure | Count |
| --- | ---: |
| Valid legacy source rows | 55 |
| v2 rows with a legacy ID | 55 |
| Missing in v2 | 0 |
| Extra in v2 | 0 |
| Duplicate legacy IDs in source | 0 |
| Field-level mismatches | 0 |
| Skipped by import rules | 0 |


## Follow-up options

1. Preserve the current `skipDuplicates` behavior until an update policy for manual v2 edits is agreed.
2. Add migrations/models/endpoints for omitted legacy tables only where the v2 product needs those records; importing unused session/API records is generally not useful.
