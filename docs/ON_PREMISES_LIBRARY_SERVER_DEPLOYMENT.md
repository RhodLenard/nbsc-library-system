# On-premises library server deployment

This guide deploys Library System v2 on a dedicated Windows computer in the library. Staff, members, and mobile devices connect through the library network using one HTTPS address.

For a beginner-friendly first deployment, use [SIMPLE_LIBRARY_SERVER_SETUP.md](SIMPLE_LIBRARY_SERVER_SETUP.md) before this detailed runbook.

## What this deployment provides

```text
Laptop / desktop / mobile browser
              |
              | HTTPS: 443
              v
Library server: Caddy
  - serves the React frontend
  - forwards /v1/* to the API
              |
              | localhost only: 3001
              v
Node.js API  --->  MariaDB production database
              |
              v
External or network backup storage
```

The public website and API use the same hostname, for example `https://library.example.edu`. This avoids exposing the API port to library devices and keeps CORS limited to one origin.

## Current project readiness

The application already provides:

- production frontend and API builds;
- Prisma versioned migrations;
- API health endpoint at `/v1/health`;
- JWT authentication, bcrypt password hashes, staff authorization, audits, and restrictive production CORS validation;
- legacy SQL snapshot import with staging and reject records;
- verified MariaDB backups and restore testing into a separate database;
- local API tests and Playwright browser smoke test.

Do **not** use the checked-in `docker-compose.yml` unchanged for production. It contains local placeholder credentials and a `localhost` CORS origin, which the API intentionally rejects in production.

## Before starting

1. Use a dedicated, always-on library PC or virtual machine. Do not use a normal staff workstation.
2. Assign a fixed network address through the router or Windows network settings.
3. Ask the school network administrator for a DNS name, such as `library.example.edu`, that resolves to this computer for library devices.
4. Prepare a separate backup destination, such as a protected NAS share or external drive. It must not be inside the application folder or the MariaDB data directory.
5. Prepare a separate, empty MariaDB database solely for restore tests, for example `library_v2_restore_test`.
6. Keep the legacy application read-only but available until the new system has passed acceptance checks.

## HTTPS decision

### Preferred: institution-managed DNS name

Use a real school-controlled hostname, such as `library.example.edu`, with a certificate trusted by all client devices. This is the best option for staff laptops and mobile devices because browsers trust the certificate without installing anything on each device.

If the hostname is publicly reachable, Caddy can automatically obtain and renew a certificate. This requires DNS to point to the server and ports 80 and 443 to be reachable for certificate validation. Do not expose MariaDB or API port 3001 publicly.

### Internal-only hostname

For a hostname available only on the library network, Caddy can issue an internal certificate with `tls internal`. Every laptop and mobile device must then trust Caddy's internal root certificate. This is practical only when library IT manages all devices. It is inconvenient for visitor or personally owned phones.

Never use plain HTTP for regular sign-in or circulation use.

## Install software on the library server

Install these items using the library IT account:

- Node.js 22 LTS;
- pnpm 10;
- MariaDB 11.4, or Docker Desktop with a dedicated MariaDB container;
- Caddy web server;
- Git, if releases will be pulled from the repository.

Caddy should run as a Windows service so that it survives logoff and reboot. The official Caddy documentation recommends running it as a service and documents Windows service installation. [Caddy install guide](https://caddyserver.com/docs/install) and [Windows service guide](https://caddyserver.com/docs/running).

## Prepare folders and accounts

Use paths outside the user profile:

```text
C:\LibrarySystem\app                 application checkout
C:\LibrarySystemData\backups         backup files
C:\LibrarySystemData\logs            Caddy and service logs
```

Create a non-administrator Windows account to run the API. Grant it read access to `C:\LibrarySystem\app` and write access only to `C:\LibrarySystemData\backups` and `C:\LibrarySystemData\logs`.

Create a MariaDB application user with access only to the `library_v2` database. Do not use the MariaDB root account in `DATABASE_URL`.

## Configure production secrets

Create `C:\LibrarySystem\app\server\.env`. It is ignored by Git and must never be committed.

```env
NODE_ENV=production
PORT=3001
DATABASE_URL="mysql://library_app:REPLACE_WITH_DATABASE_PASSWORD@127.0.0.1:3306/library_v2"
JWT_SECRET="REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS"
CORS_ORIGIN="https://library.example.edu"
BACKUP_DIR="C:\LibrarySystemData\backups"
BACKUP_RESTORE_TEST_DATABASE_URL="mysql://restore_user:REPLACE_WITH_RESTORE_PASSWORD@127.0.0.1:3306/library_v2_restore_test"
```

Generate a secret in PowerShell and store the output in a password manager:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Build the frontend with the real HTTPS address. In `C:\LibrarySystem\app\.env`, set:

```env
VITE_API_URL=https://library.example.edu/v1
```

The API URL is embedded during the frontend build. Rebuild the frontend whenever this URL changes.

## Build and migrate

Run these commands from `C:\LibrarySystem\app` in PowerShell:

```powershell
pnpm install --frozen-lockfile
pnpm --dir server install --frozen-lockfile
pnpm --dir server prisma:generate
pnpm build
pnpm --dir server build
pnpm --dir server prisma:migrate
```

Run the local quality checks before each release:

```powershell
pnpm --dir server test
pnpm e2e
```

## Create the first administrator

Create the initial administrator immediately after migrations and **before** importing legacy staff records. The bootstrap command refuses to run after an Admin exists.

```powershell
$env:ADMIN_BOOTSTRAP_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
pnpm --dir server bootstrap:admin -- --employee-id "ADMIN-001" --name "Library Administrator" --email "library-admin@example.edu"
Remove-Item Env:ADMIN_BOOTSTRAP_PASSWORD
```

Store the initial password securely and change it after first sign-in.

## Import production-like or legacy data

Copy an approved, read-only legacy SQL snapshot into `data\legacy-copy\`. Then import it:

```powershell
pnpm --dir server import:legacy -- ..\data\legacy-copy\librarysystem.sql
```

Check the import run, reject records, and record counts before cutover. The importer never connects to the legacy database and does not overwrite manually changed v2 records on rerun.

## Configure Caddy

Save this as `C:\Caddy\Caddyfile`, replacing the hostname and paths:

```caddyfile
library.example.edu {
    root * C:/LibrarySystem/app/dist
    encode zstd gzip

    handle /v1/* {
        reverse_proxy 127.0.0.1:3001
    }

    handle {
        try_files {path} /index.html
        file_server
    }

    log {
        output file C:/LibrarySystemData/logs/caddy-access.log
        format json
    }
}
```

For an internal-only hostname, add `tls internal` inside the site block. Before allowing other devices to use it, install Caddy's root certificate on every managed client. Caddy documents this requirement for other devices on an internal network. [Caddy local HTTPS guidance](https://caddyserver.com/docs/running)

Allow inbound TCP 443 in Windows Firewall. Do not allow inbound TCP 3001 or MariaDB port 3306 from the library network. Caddy alone should be reachable by users.

## Run the API as a Windows service

Create a Windows service or scheduled task that runs this command under the restricted API account:

```powershell
pnpm --dir C:\LibrarySystem\app\server start
```

Set its working directory to `C:\LibrarySystem\app\server`, configure automatic restart on failure, and direct standard output/error to `C:\LibrarySystemData\logs`. Start Caddy as its own automatic Windows service.

After both services start, verify locally:

```powershell
Invoke-WebRequest https://library.example.edu/v1/health
```

Then test from a staff laptop, a different desktop, and a mobile device on the library Wi-Fi.

## Production cutover checklist

1. Put the legacy system into maintenance or read-only mode.
2. Take and label a final legacy database backup.
3. Take a backup of the empty/new v2 database before importing.
4. Run migrations, create the initial Admin, and import the approved snapshot.
5. Verify catalog, copies, members, staff accounts, active loans, reservations, fines, and rejected import rows.
6. Start API and Caddy services.
7. Test HTTPS, staff login, member login, catalog search, borrow, return, reservation, fine payment, and logout from another device.
8. Run a manual v2 backup and confirm it is marked `Completed` after checksum verification.
9. Record the backup checksum, restore result, and the responsible staff member.
10. Announce the new address only after all checks pass.

## Daily operations

- Review the API health endpoint and Caddy/API logs daily during the first two weeks.
- Confirm the scheduled 02:00 backup creates a `VERIFIED` backup run.
- Test restoration into the separate restore database at least monthly.
- Apply application updates in a maintenance window: take a backup, run local checks, deploy, migrate, then smoke-test from another device.
- Keep Windows, Node.js, MariaDB, Caddy, and browser devices patched.

## Rollback plan

Do not roll back by deleting database files. If cutover fails:

1. Stop new library activity in v2.
2. Preserve the v2 database and logs for investigation.
3. Return users to the read-only legacy system only if necessary.
4. Restore the verified v2 backup only into the designated recovery process, never over the live database without an approved incident decision.
5. Record the time of cutover, last successful backup, failure symptom, and the chosen recovery action.

## Acceptance evidence

Keep a short record containing:

- server hostname and static address;
- migration command output;
- import run ID, record counts, and reject count;
- administrator account creation confirmation;
- URLs tested from laptop, desktop, and mobile;
- backup checksum and completed backup result;
- screenshots or exports of health, audit, and backup records;
- rollback contact and location of the final legacy backup.
