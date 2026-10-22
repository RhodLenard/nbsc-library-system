# Phase 4 — Real workflows changes

## Implemented

- `server/src/lib/spreadsheets.ts` parses the first CSV/XLSX worksheet on the API and generates CSV/XLSX download content.
- `server/src/routes/catalog.ts` adds authenticated staff catalog import and catalog export endpoints. Import results report each rejected row and only report records as imported after the database transaction writes them.
- `server/src/routes/management.ts` accepts CSV/XLSX member imports, adds authenticated member exports, and records a replacement fine and replacement status in one transaction.
- `src/pages/staff/ImportBooks.tsx` replaces the simulated wizard with a real upload flow.
- `src/pages/staff/ImportUsers.tsx` accepts CSV and XLSX uploads rather than CSV alone.
- `src/pages/staff/Catalog.tsx` downloads a real server-generated CSV/XLSX catalog export.
- `src/pages/staff/Members.tsx` downloads a real server-generated member CSV export.
- `src/pages/staff/Lost.tsx` collects an explicit replacement-fine amount and calls the real replacement endpoint; the demo charge button is removed.
- `src/lib/api.ts` adds authenticated binary-download handling.
- `src/pages/staff/Admins.tsx` uses the finalized staff roles in its editor.
- `src/pages/staff/Members.tsx` no longer contains the retired `Assistant` role check.
- `src/pages/staff/Backups.tsx` no longer reports a simulated deletion as successful.
- `src/pages/staff/Reports.tsx` no longer presents report data as demo data or claims a file was generated; download authorization remains pending.
- `server/src/routes/management.ts` adds a staff-only member-password reset endpoint. It generates a new high-entropy password, stores only its bcrypt hash, and writes a `MEMBER_PASSWORD_RESET` audit event without recording the password.
- `src/pages/staff/Members.tsx` adds a Generate new password action and a one-time copy dialog for the generated password.
- `src/lib/types.ts` defines the NBS College program list as BSCS, BSA, BSAIS, BSE, and BSTM. All forms and report filters that use the shared program list now show only those values.
- `server/src/routes/management.ts` and `server/src/routes/catalog.ts` reject new member, catalog, and spreadsheet-import records using any other program value. Existing historical records are not rewritten.
- `server/prisma/migrations/202610220001_normalize_nbs_programs/migration.sql` normalizes existing imported values: Accounting/Accountancy → BSA, Entrepreneurship → BSE, and Tourism Management → BSTM, for members and catalog titles. The migration was applied successfully to `library_v2`.
- `server/prisma/migrations/202610220002_normalize_remaining_nbs_programs/migration.sql` keeps Accounting Information Systems distinct as BSAIS and maps Computer Science → BSCS plus the Entrep abbreviation → BSE. The migration was applied successfully to `library_v2`.
- `src/pages/staff/Members.tsx` and `src/pages/staff/Reports.tsx` now send the active filters with each export request. `server/src/routes/management.ts` applies those filters before generating the download, so exported rows match the filtered table.
- `server/package.json` and the lockfile add `xlsx` for API-side spreadsheet parsing and generation.

## Report downloads

Report CSV/XLSX downloads are available only through the shared staff permission set: Admin, Librarian, and Student Assistant. Members cannot access the endpoint. Exports use the corresponding staff report columns and are recorded as `REPORT_EXPORT` audit events.

## Verification

- `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` and `pnpm --dir server exec tsc -p tsconfig.json --noEmit` completed successfully.
- The normal production build could not write to `server/dist` or `dist` because those output folders are locked by running development processes. This is an environment lock, not a TypeScript failure.
