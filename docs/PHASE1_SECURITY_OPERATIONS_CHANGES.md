# Phase 1 Security and Operations Changes

Scope: latest `Library System v2` only. No legacy-system files or databases were accessed or changed.

## Files changed

- `server/prisma/schema.prisma` — added `AuditEvent`, `BackupRun`, and `RolePermission` models.
- `server/prisma/migrations/202610180001_phase1_security_operations/migration.sql` — additive tables/indexes, Assistant→Student Assistant data migration, and initial role-permission rows; Encoder rows are preserved.
- `server/src/lib/roles.ts` — single-source role/permission matrix lookup and shared staff permission guard.
- `server/src/lib/auth.ts` — staff guards now use the shared matrix and reject unknown roles.
- `server/src/lib/audit.ts` — redacted, non-blocking audit persistence service.
- `server/src/routes/auth.ts` — successful/failed/rate-limited login events and five-failures-per-15-minutes throttling.
- `server/src/routes/app-data.ts` — staff member-record view audit plus real audit/backup data in bootstrap.
- `server/src/routes/management.ts` — read-only audit/backup endpoints and manual verified-backup trigger; self-lockout and last-active-Admin safeguards.
- `server/src/lib/backup.ts` — MariaDB dump, SHA-256 checksum, verification, and `backup_runs` status handling.
- `server/src/index.ts` — staff request audit middleware and daily 02:00 backup scheduler.
- `server/src/importer/import-snapshot.ts` — new imports use Student Assistant for legacy assistant rows.
- `src/lib/types.ts`, `src/lib/nav.ts`, `src/pages/Login.tsx`, `src/lib/seed.ts` — four-role frontend labels and identical staff navigation.
- `src/pages/staff/Backups.tsx` — removed simulated run completion; uses the real API and clearly disables unsupported download/restore/delete operations.
- `server/src/lib/phase1.test.ts` — tests for matrix behavior, audit redaction, and rate-limit constants.

## Local limitations

- Docker Desktop's Linux engine was not running during this implementation pass, so the v2 migration could not be applied and live Encoder accounts could not be listed. Start Docker Desktop, then run `pnpm --dir server prisma:migrate`; use the Encoder query in `FEATURE_SCAN_REPORT.md` before assigning those accounts. `mariadb-dump` must also be available to the API process; otherwise a backup run is recorded as `FAILED` with its tool error. The scheduler and verification path are real.
- Backup download, restore, and deletion are intentionally disabled in the UI because no approved storage/restore authorization policy was supplied.
- Existing `Encoder` accounts remain unchanged and require explicit role decisions using the query in `FEATURE_SCAN_REPORT.md`.

## Verification

- `pnpm --dir server build` passes.
- `pnpm build` passes.
- `pnpm --dir server test` covers the Phase 1 unit cases.
