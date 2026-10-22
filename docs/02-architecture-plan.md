# Library System v2 architecture

## Runtime

The React client is deployed separately from the API. It calls the TypeScript API over HTTPS using a configured `VITE_API_URL`. The API uses Prisma ORM 7 with `provider = "mysql"` against a dedicated MariaDB 11.4 LTS database. MariaDB is pinned to its current patch release in every deployment manifest.

The application database defaults to `utf8mb4_unicode_ci`, with InnoDB and `READ COMMITTED` transactions. Runtime and migration accounts are non-root and have separate credentials. Prisma migrations are committed SQL; views, triggers, procedures, and explicit collations that Prisma cannot model are hand-authored in those migrations.

## Legacy boundary

The legacy PHP application and its MariaDB 10.4 database remain untouched. v2 imports only an SQL snapshot placed in `data/legacy-copy/`; neither a legacy database URL nor a legacy account is accepted by v2 configuration.

Each import creates a run record, stages parsed rows, retains source IDs as `legacy_id`, retains exact source status as `legacy_status`, and writes a versioned mapping into `legacy_status_mappings`. Invalid records are written to `legacy_import_rejects` with their original payload. Legacy values remain `utf8mb4_general_ci`; new canonical fields use `utf8mb4_unicode_ci`.

## Circulation consistency

Issue, return, and reservation fulfillment use short Serializable InnoDB transactions. They validate member status and fines, lock/check copy availability, change the copy state, and create the associated record atomically. Client retryable mutations send `Idempotency-Key` values.

## Deployment

Run the API behind TLS with `CORS_ORIGIN` limited to the React host. Back up MariaDB before migrations and test restore in staging. Deploy database migrations before the API release; use the old v2 API image as rollback only when the migration is backward-compatible.
