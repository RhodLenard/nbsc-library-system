# Library System v2 — Feature Scan Report

**Scope and method.** This report covers only `C:\Projects\Library System v2`. It was prepared from the current source, Prisma schema, migrations, configuration, and UI routes. No legacy system was opened, scanned, modified, moved, or deleted. No feature code was added.

## 1. Current system

### Technology and structure

- **Frontend:** React 19, TypeScript, Vite 8, React Router hash routing, Tailwind CSS 4, Lucide, and Recharts. The member and staff portals are in `src/`; pages are lazy-loaded from `src/App.tsx`.
- **API:** Node.js/TypeScript, Express 5, Zod request validation, Prisma 7, MariaDB driver, bcryptjs, JWT, and CORS. API routes are mounted under `/v1` in `server/src/index.ts`.
- **Database:** MariaDB 11.4 (`mysql` Prisma provider), with a separate `library_v2` database in Docker Compose. Database changes are versioned under `server/prisma/migrations/`.
- **Key folders:** `src/components` (shell/UI), `src/pages/member` and `src/pages/staff` (portal workflows), `src/lib` (client API/session/state), `server/src/routes` (auth, catalog, circulation, management, app bootstrap), `server/prisma` (schema/migrations), `server/src/importer` and `server/src/reconciliation` (legacy-snapshot-only import/reconciliation), and `docs` (architecture/import documentation).

### Database schema

All primary IDs are CUID strings unless noted. Names shown below are physical table names.

| Table | Columns | Relationships / purpose |
|---|---|---|
| `members` | `id`, `legacy_id` unique, `legacy_status`, `school_id` unique, `name`, `email` unique, `password_hash`, `program`, `member_type`, `phone`, `status` (`ACTIVE/INACTIVE/ARCHIVED`), `imported_at`, `created_at`, `updated_at` | One member has many `loans` and `reservations`. Member identity/profile and credentials. |
| `staff` | `id`, `legacy_id` unique, `legacy_status`, `employee_id` unique, `name`, `email` unique, `password_hash`, `role`, `status` (`ACTIVE/INACTIVE`), `imported_at`, `created_at`, `updated_at` | No enforced FK activity ownership. Staff accounts/roles. |
| `book_titles` | `id`, `legacy_key` unique, `title`, `preferred_title`, `isbn`, `subject_category`, `program`, `summary`, `contents`, `cover_image`, `publisher_id`, `publication_year`, `created_at` | Optional many-to-one to `publishers`; one-to-many `copies`, `reservations`, `title_contributors`. Indexed by title and ISBN. |
| `authors` | `id`, `legacy_id` unique, `first_name`, `middle_initial`, `last_name`, `display_name` | One-to-many `title_contributors`. |
| `publishers` | `id`, `legacy_id` unique, `name`, `place` | One-to-many `book_titles`. |
| `corporate_contributors` | `id`, `legacy_id` unique, `name`, `type`, `location`, `description` | One-to-many `title_contributors`. |
| `title_contributors` | `id`, `legacy_id`, `legacy_source_table`, `title_id`, `author_id`, `corporate_id`, `role` | Joins a title to either an author or corporate contributor; unique `(legacy_source_table, legacy_id)`. |
| `copies` | `id`, `legacy_id` unique, `legacy_status`, `legacy_accession`, `accession` unique, `title_id`, `copy_number`, `call_number`, `shelf_location`, `status` (`AVAILABLE/ON_LOAN/RESERVED/LOST/DAMAGED/REPLACED/REPAIR`), `imported_at` | Many-to-one title; one-to-many loans, reservations, incidents. Indexed by `(status, shelf_location)`. |
| `copy_incidents` | `id`, `copy_id`, `member_id`, `type`, `status` (default `UNREPLACED`), `reported_at`, `resolved_at` | FK only to `copies`; `member_id` is not a Prisma relation. Lost/damaged tracking. |
| `loans` | `id`, `legacy_id` unique, `legacy_status`, `member_id`, `copy_id`, `status` (`ACTIVE/RETURNED/LOST`), `issued_at`, `due_at`, `returned_at` | Many-to-one member and copy; one-to-many `fines`. Indexed by member/copy plus status. |
| `reservations` | `id`, `legacy_id` unique, `legacy_status`, `member_id`, `title_id`, nullable `copy_id`, `status` (`PENDING/READY/RECEIVED/CANCELLED/EXPIRED`), `reserved_at`, `ready_at`, `received_at`, `cancelled_at` | Many-to-one member/title and optional copy. Indexed by member, copy, and title plus status. No queue position or expiry timestamp distinct from `ready_at`. |
| `fines` | `id`, `legacy_id` unique, `legacy_status`, `loan_id`, `amount decimal(12,2)`, `status` (`UNPAID/PAID/WAIVED`), `reason`, `assessed_at`, `paid_at`, `payment_method` | Many-to-one loan; indexed by status. |
| `messages` | `id`, `sender_id`, `recipient_id`, `subject`, `body`, `read_at`, `created_at` | Identifier fields, not member/staff FKs; supports member/staff inboxes. |
| `notifications` | `id`, `recipient_id`, `kind`, `text`, `read_at`, `created_at` | Identifier field, not member/staff FK; in-app notifications. |
| `library_visits` | `id`, `member_id`, `entered_at`, `exited_at` | `member_id` is not a Prisma relation; visit logging. |
| `idempotency_keys` | `id`, `principal_id`, `method`, `path`, `key`, `request_hash`, `response` JSON, `status_code`, `expires_at`, `created_at` | Unique `(principal_id, method, path, key)`; protects POST retries. |
| `legacy_status_mappings` | `id`, `entity_type`, `legacy_value`, `target_value`, `mapping_version`, `reason`, `created_at` | Unique legacy normalization mapping. |
| `legacy_import_runs` | `id`, `source_path`, `source_sha256`, `started_at`, `completed_at`, `status` | Legacy snapshot import run metadata. |
| `legacy_import_rejects` | `id`, `run_id`, `source_table`, `legacy_id`, `reason`, `payload` JSON, `created_at` | Rejected legacy source rows; indexed by run/table. |
| `legacy_stage_rows` | unsigned bigint `id`, `run_id`, `source_table`, `legacy_id`, `payload` JSON, `source_collation`, `staged_at` | Staged legacy import rows; indexed by run/table. |

### Authentication, roles, workflows, and operational state

- **Authentication:** Login accepts email or institutional ID, checks bcrypt password hashes, and returns a signed JWT bearer token with a 15-minute lifetime. The frontend keeps it in `sessionStorage`. Password changes require the current password and use bcrypt cost 12. Production rejects placeholder secrets, requires a 32+ character JWT secret, HTTPS CORS origins, and an explicit origin allowlist.
- **Roles:** `Member`, `Admin`, `Librarian`, `Assistant`, and `Encoder`. Route guards enforce staff-only operations; Admin manages staff; Librarian/Assistant/Admin handle circulation and member management; Encoder can maintain catalog records. Roles are free-text in the DB but Zod/API guards recognize these names.
- **Catalog:** Public API search/detail supports title, preferred title, ISBN, category/program filters, availability, and selected sorting. Staff can create/update titles, copies, publishers/contributors. No catalog policy/article repository exists.
- **Borrow/return/fines:** Staff issue up to three selected copies in a serializable transaction after confirming active member, no unpaid fine, and available copies. Return marks a copy available and automatically creates an overdue fine at 5 per elapsed day. Staff can record payments. Lost/damaged incidents and replacement/restoration are available.
- **Reservations:** Members can reserve only titles with an immediately available copy; the API caps active reservations at three and rejects duplicate active title requests. Staff select a copy to make a reservation READY, reserve it, set a hard-coded 48-hour pickup deadline, create an in-app notification, and can receive it into a hard-coded 7-day loan. Members/staff can cancel. There is no automatic expiration job or next-person promotion.
- **Member management/communications:** Staff can create/update/status-change members, CSV-import members, manage staff accounts, record library visits, and send internal messages. Notifications are in-app only.
- **Responsive/mobile:** The shell has a mobile drawer and Tailwind breakpoints (`sm`, `md`, `lg`); the staff sidebar collapses below `lg`, and content tables/cards use responsive classes. It is a responsive web portal, not a native/mobile app. No QR generator/scanner is present.
- **Logging/backups:** Import/reconciliation activity is persisted for legacy imports and `idempotency_keys` retain request responses temporarily. The staff Activity Log uses frontend state/seed data, not a server audit table. The Backup Manager is explicitly simulated: it creates, downloads, restores, and monitors no real backup files or schedules.

## 2. Gap analysis

| Feature | Status | Evidence / involved files and tables | Gap |
|---|---|---|---|
| AI librarian assistant | **Missing** | Catalog data: `book_titles`, `authors`, `publishers`, `corporate_contributors`, `title_contributors`; API: `server/src/routes/catalog.ts` and `app-data.ts`; member catalog pages. | No chat UI/API, model integration, approved-information store, retrieval layer, grounding/citation guard, moderation, or assistant audit trail. |
| Smart reservation and waitlist | **Partial** | `reservations`, `copies`, `notifications`; `server/src/routes/circulation.ts`; `src/pages/member/Reserved.tsx`, `ReservationHistory.tsx`, `src/pages/staff/Reservations.tsx`, and `src/lib/actions.ts`. | Statuses, manual pickup preparation, cancellation, and in-app notifications exist. There is no queue sequence, unavailable-title waitlist, automatic availability trigger, scheduled expiry, or automatic next-member notification. |
| Advanced security and audit logs | **Partial** | `server/src/lib/auth.ts`, `routes/auth.ts`, `index.ts`, `lib/idempotency.ts`; `members`, `staff`, `idempotency_keys`, import tables; `src/pages/staff/Activity.tsx`, `Backups.tsx`. | JWT/bcrypt/RBAC/Zod/CORS/production secret checks/idempotency exist. Missing durable staff audit events, login/security-event audit, rate limiting, token revocation/refresh/session tracking, real backup execution/monitoring, privacy consent/retention/export/deletion controls, and access-record auditing. UI activity/backups are simulated. |
| Digital library and mobile access | **Partial** | Responsive shell/UI: `src/components/Shell.tsx`, `src/index.css`, portal pages; catalog tables/pages above. | Responsive member portal and physical catalog exist. No e-book/digital-resource URL metadata or viewer links, saved/persistent reading lists (cart is client UI state), QR codes, offline/PWA support, or mobile-specific access flow. |

## 3. Feasibility and recommended implementation order

All four capabilities can be added to the v2 system without replacing borrow, return, fine, or current reservation workflows, provided changes are introduced through additive Prisma migrations and transaction-safe API updates.

1. **Establish security/operational foundations first.** Add a durable append-only audit-event module/table and service; real backup job/run/verification records; privacy settings/retention mechanisms; and security hardening such as rate limits and session/revocation design. Risks: audit data can expose personal information; backup/restore implementation must be tested against MariaDB recovery and must not use the prototype backup UI as an operational control.
2. **Replace reservation handling with a queue-capable service.** Extend `reservations` with deterministic queue ordering and hold-expiry data (or introduce a queue/hold model), add a scheduler/worker, and make return/cancel/expiry promote the next eligible reservation atomically. Preserve existing reservation statuses and endpoints during migration. Risks: races among return, cancellation, staff issue, and expiry; preventing duplicate claims; correctly reconciling `copies.status`.
3. **Add the digital-resource/member-access foundation.** Add digital-resource/e-book metadata tied to titles, persistent reading-list entities, and QR token support with expiry/revocation. Keep external provider URLs isolated from catalog editing/authorization paths. Risks: licensed-link access rules, URL safety, QR token leakage, and an unclear distinction between a cart and saved list.
4. **Build the AI librarian on an approved knowledge boundary.** Create a curated policy/FAQ repository with publishing/approval state, a catalog retrieval module, assistant conversations/messages, and a server-side response pipeline that only receives retrieved catalog fields and approved articles. Return citations/links to source records and refuse unsupported policy claims. Risks: prompt injection in catalog/policy text, hallucinated policy answers, sensitive member data exposure, provider cost/availability, and retention of chat transcripts.

### Proposed modules and schema additions

- **Security/operations:** `audit_events` (actor, action, target, timestamp, correlation/request metadata, redacted before/after data), `backup_runs` (provider/location reference, status, started/completed/verified timestamps, checksum/size, error), security-session/revocation records if JWT revocation is required, and privacy-consent/retention request records.
- **Reservations:** Add a stable queue order and explicit hold-expiry timestamp to reservations, or separate `reservation_queue_entries` and `reservation_holds`; add a notification-delivery table to track channel, attempt, delivery result, and retry state. Add a worker/scheduled-job module for expiry/promotions.
- **Digital:** `digital_resources` related to `book_titles` (resource type, authorized URL/provider identifier, access rules, availability/status) and `reading_lists`/`reading_list_items` related to members/titles. Use a signed, short-lived QR payload rather than storing raw member data in a QR image.
- **AI:** `knowledge_articles` (approved policy/FAQ content, source/version, status, reviewer/published timestamps), `assistant_conversations`, `assistant_messages`, and optional retrieval/audit records. The API should expose one constrained assistant endpoint; it must never retrieve member/account/loan/fine data unless a separately approved future feature requires it.

## 4. Policy decisions required before implementation

The following rules are not sufficiently specified by the product request and need confirmation. Existing hard-coded values are implementation behavior, not confirmed policy.

1. Reservation eligibility: may a member queue only when every copy is unavailable, or reserve an available copy too? May they reserve a title they currently have on loan?
2. Reservation limits: maximum active holds/waitlist entries per member; per-title duplicate rule; whether overdue loans/unpaid fines/inactive status block queueing or promotion.
3. Queue ordering: strict FIFO or priority classes; tie-breaking; staff override authority and required reason/audit.
4. Pickup hold: exact duration, timezone/calendar-hours versus open-library-hours, reminder timing, and what happens on expiry (automatic cancel, next-member promotion, copy status).
5. Notifications: approved channels (in-app, email, SMS, other), sender identity, delivery/retry/failure handling, quiet hours, and opt-in/out rules.
6. Loan/fine policies that the system presently hard-codes: maximum issue count, default loan length, overdue rate/currency, fine caps/grace periods, waivers, and reservation-to-loan due date.
7. AI knowledge scope: who approves policies/articles, required citations/disclaimers, languages, prohibited topics, model/provider approval, and conversation retention/review rules.
8. Digital-resource policy: authorized providers/licensing, authentication/entitlement rules, e-book link expiry, download versus browser access, and resource availability metadata.
9. Reading lists: private versus staff-visible, item/list limits, sharing/export rules, and retention on member deactivation/archival.
10. QR usage: intended action (member identification, checkout, digital link, or all), expiry/reuse, scanner/device requirements, fallback if a QR is shared/lost, and whether PII may ever be encoded (recommended: no).
11. Security/audit: authoritative role-permission matrix, audit actions/fields, immutability/access controls, audit-log retention, security-alert recipients, incident response, session timeout/revocation, and MFA requirement.
12. Privacy/backups: data classification, consent/legal basis, member data export/correction/deletion process, retention schedules by record type, backup frequency/retention/encryption/location, restore test frequency, RPO/RTO, and who may restore/download backups.

## Acceptance checks for the future build

- Existing catalog CRUD, circulation, member management, current reservation history, and legacy import/reconciliation remain functional after migrations.
- Concurrent availability, promotion, cancellation, and expiry attempts result in one valid queue/hold outcome and no copy is double-issued.
- Every privileged and sensitive-record action produces a durable, queryable audit event without password/token/PII overcollection.
- Backup success is reported only after the configured verification criterion succeeds; restore is rehearsed in a safe environment.
- Assistant answers cite catalog or approved knowledge sources, reject unsupported policy assertions, and cannot access member records.
- Digital links enforce the agreed access policy; saved lists persist across sessions; QR payloads are short-lived, signed, and contain no raw personal data.

## Phase 1 role migration note

The approved four-role set is now `Admin`, `Librarian`, `Student Assistant`, and `Member`. The additive migration converts only existing `Assistant` values to `Student Assistant`; it deliberately does **not** convert `Encoder` accounts. The implementation environment did not have a running v2 MariaDB instance available for a live account listing, so the pending Encoder review query is:

```sql
SELECT id, employee_id, name, email, role, status
FROM staff
WHERE role = 'Encoder'
ORDER BY name;
```

Every row returned must be assigned explicitly before that account can authenticate; unknown roles are rejected by the API.
