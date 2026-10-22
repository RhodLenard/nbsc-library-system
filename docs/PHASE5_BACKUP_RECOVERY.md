# Phase 5 — Backup and recovery

## Corrections made

- The production API image now installs `mariadb` and `mariadb-dump` through `mariadb-client`.
- `BACKUP_DIR` is now mandatory and must be an absolute path outside the API application directory. A backup attempt without a compliant directory is recorded as `FAILED`; it is never reported as successful.
- Docker Compose mounts `BACKUP_HOST_DIR` at `/backups`, so backup files are stored on separately selected host or mounted storage rather than inside the API container filesystem.
- A SHA-256 checksum is created and re-read before a backup is marked `VERIFIED`.
- Automatic daily backups continue to run at 02:00. Successful and failed automatic runs now create durable audit events. Staff-requested runs additionally record the requesting staff member and actual role.
- Admin, Librarian, and Student Assistant use the shared staff permission set for backup viewing, creation, and clean-database restore testing. Members have no route or UI access.
- Restore testing accepts only verified backups, rechecks the checksum, requires `BACKUP_RESTORE_TEST_DATABASE_URL`, and rejects any target equal to the live database. Restore test success/failure is audit logged.

## Required deployment configuration

Set these values before deploying or running a recovery test:

```env
BACKUP_HOST_DIR=/secure/mounted/library-backups
BACKUP_RESTORE_TEST_DATABASE_URL=mysql://restore_user:password@restore-db:3306/library_v2_restore_test
```

`BACKUP_HOST_DIR` must be a separately managed, access-controlled storage location. The restore target must be an empty, non-production MariaDB database whose credentials can create all objects contained in the dump.

## Restore test procedure

1. Configure the external backup mount and separate clean database URL above.
2. Deploy the API image and run a manual backup from Backup Manager.
3. Confirm the run reports `Completed` only after checksum verification.
4. Choose **Test restore** on that verified backup.
5. Confirm the clean target contains the expected tables and record counts, then inspect `BACKUP_RESTORE_TEST_COMPLETED` in Activity Log.

## Current verification and blocker

- Frontend and API TypeScript checks pass.
- A full restore test was not run in this workspace: `BACKUP_HOST_DIR`, `BACKUP_RESTORE_TEST_DATABASE_URL`, and local MariaDB client binaries are not configured. This is intentional—the test must not target the live database or use an application-local backup directory.
