# Library System v2

React/Vite frontend and a standalone TypeScript API for the next-generation library system. The v2 application owns a separate MariaDB database; it never connects to the legacy application database.

## Local development

1. Copy `.env.example` to `.env` and `server/.env.example` to `server/.env`.
2. Start MariaDB 11.4 and the API with `docker compose up --build`.
3. In another terminal, run `pnpm install` then `pnpm dev` for the frontend.
4. Run `pnpm --dir server prisma:generate` and `pnpm --dir server prisma:migrate` after dependencies are installed.

Public member self-registration is disabled. After migrations have run, create the first administrator once:

```powershell
$env:ADMIN_BOOTSTRAP_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
pnpm --dir server bootstrap:admin -- --employee-id "ADMIN-001" --name "Library Administrator" --email "admin@example.edu"
Remove-Item Env:ADMIN_BOOTSTRAP_PASSWORD
```

The bootstrap command refuses to run after an Admin account exists. In production, provide `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and HTTPS-only `CORS_ORIGIN` from a secret manager; the API refuses placeholder or local values.

Set `VITE_API_URL` to the deployed API's `/v1` URL. The local API accepts the standard Vite development origin at `localhost:5173`; production must use HTTPS, secret-managed values, a non-root MariaDB account, and a restrictive `CORS_ORIGIN`.

## Legacy imports

Put an immutable SQL snapshot in `data/legacy-copy/` (ignored by Git) and run:

```powershell
pnpm --dir server import:legacy -- ..\data\legacy-copy\librarysystem.sql
```

The importer refuses paths outside that folder and has no legacy connection configuration. It stages input, preserves source primary keys and status text, and records rejects in `legacy_import_rejects`.

The supplied legacy snapshot has been imported into the local v2 database. Re-running the same command is safe: normalized rows are matched by source identity and existing rows are not duplicated.
