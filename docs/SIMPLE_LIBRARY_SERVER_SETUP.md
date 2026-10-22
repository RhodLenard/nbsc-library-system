# Simple guide: put Library System v2 on the library computer

Use this guide when you are ready to put the system on the computer in the library so staff and students can open it using a laptop, desktop, or phone.

The library computer will run three things:

```text
MariaDB = saves library data
Node API = handles login, borrowing, returns, and data
Caddy = shows the website to other devices safely with HTTPS
```

You only need to do the steps in order. Do not delete the old XAMPP system until the new one works and the backup has been checked.

For full technical details, see [ON_PREMISES_LIBRARY_SERVER_DEPLOYMENT.md](ON_PREMISES_LIBRARY_SERVER_DEPLOYMENT.md).

## Before you begin

You need:

- one library computer that stays on during library hours;
- Windows administrator access to that computer;
- a stable network connection;
- enough disk space for the application, database, and backups;
- an external drive or protected network folder for backups;
- an approved export of the school's old library database from the librarian or school IT;
- help from school IT for one thing: a permanent library website name, such as `library.example.edu`.

Use a name from school IT instead of an IP address. It lets laptops and phones use HTTPS without browser warnings.

## Important: protect school data

The old school library database contains real student and staff information. Treat its SQL backup like a confidential document.

- Get approval from the librarian or school IT before copying or importing it.
- Make the export only from the official school library system.
- Keep the backup on the library server or an encrypted school-owned drive.
- Do not upload the SQL file to GitHub, email it, put it in a public cloud drive, or share it in chat.
- Keep the old XAMPP database unchanged until the new system has been accepted by the library.

The new system reads an exported `.sql` file. It does not connect directly to the old XAMPP database and does not change it.

## Step 1: Make folders

On the library computer, create these folders:

```text
C:\LibrarySystem\app
C:\LibrarySystemData\backups
C:\LibrarySystemData\logs
```

Put the project files inside:

```text
C:\LibrarySystem\app
```

You can copy the project folder using a USB drive, or clone it from GitHub.

## Step 2: Install the needed programs

Install these programs on the library computer:

1. Node.js 22 LTS
2. pnpm
3. MariaDB 11.4
4. Caddy
5. Git, only if you will download updates from GitHub

Restart the computer after installation if Windows asks you to.

## Step 3: Create the new database

Open a MariaDB command window as an administrator. Run the following SQL. Replace both example passwords with strong passwords that you save in a password manager.

```sql
CREATE DATABASE library_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE library_v2_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'library_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_STRONG_DATABASE_PASSWORD';
GRANT ALL PRIVILEGES ON library_v2.* TO 'library_app'@'127.0.0.1';

CREATE USER 'restore_user'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_STRONG_RESTORE_PASSWORD';
GRANT ALL PRIVILEGES ON library_v2_restore_test.* TO 'restore_user'@'127.0.0.1';

FLUSH PRIVILEGES;
```

The second database is empty on purpose. It is used only to test that backups can be restored safely.

## Step 4: Ask IT for the library address

Ask school IT to make this address point to the library computer:

```text
library.example.edu
```

Replace `library.example.edu` below with the real address they give you.

Also ask IT to allow HTTPS traffic to the library computer on port **443**. Do not open MariaDB port `3306` or API port `3001` to student devices.

## Step 5: Add the secret settings

Create this file:

```text
C:\LibrarySystem\app\server\.env
```

Copy this into the file and replace every `REPLACE_...` value:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL="mysql://library_app:REPLACE_WITH_STRONG_DATABASE_PASSWORD@127.0.0.1:3306/library_v2"
JWT_SECRET="REPLACE_WITH_A_LONG_RANDOM_SECRET"
CORS_ORIGIN="https://library.example.edu"
BACKUP_DIR="C:\LibrarySystemData\backups"
BACKUP_RESTORE_TEST_DATABASE_URL="mysql://restore_user:REPLACE_WITH_STRONG_RESTORE_PASSWORD@127.0.0.1:3306/library_v2_restore_test"
```

If the library computer uses XAMPP, add this line too. It lets the new system use XAMPP's database backup program:

```env
MARIADB_DUMP_BIN="C:\\xampp\\mysql\\bin\\mysqldump.exe"
```

To create a random `JWT_SECRET`, open PowerShell and run:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Copy the result into `JWT_SECRET`. Never send this file, database passwords, or the secret to other people.

Now edit this file:

```text
C:\LibrarySystem\app\.env
```

Set this value:

```env
VITE_API_URL=https://library.example.edu/v1
```

## Step 6: Build the website and API

Open PowerShell inside `C:\LibrarySystem\app`, then run:

```powershell
pnpm install --frozen-lockfile
pnpm --dir server install --frozen-lockfile
pnpm --dir server prisma:generate
pnpm build
pnpm --dir server build
pnpm --dir server prisma:migrate
```

Wait for every command to finish without an error.

## Step 7: Create the first library administrator

Run this before importing the old staff records:

```powershell
$env:ADMIN_BOOTSTRAP_PASSWORD = "Choose-a-long-private-password"
pnpm --dir server bootstrap:admin -- --employee-id "ADMIN-001" --name "Library Administrator" --email "library-admin@example.edu"
Remove-Item Env:ADMIN_BOOTSTRAP_PASSWORD
```

Change the employee ID, name, email, and password to the real librarian's details. Save the password safely.

## Step 8: Safely copy the school library data

Ask the librarian or school IT to make the export. If they ask you to do it in phpMyAdmin, use this process:

1. On the old library server, open phpMyAdmin from XAMPP.
2. Select the official school library database.
3. Select **Export**, choose **Quick**, choose **SQL**, then click **Export**.
4. Save the file with a clear name, such as `library-school-final-YYYY-MM-DD.sql`.
5. Store one untouched copy in the school's approved backup location. This is the rollback copy.
6. Copy a second working copy to the new library server using a secure school-owned USB drive or network share.
7. Do not change the old XAMPP data after this final export until cutover is complete.

## Step 9: Import the school export into the new system

Copy the approved working `.sql` file into:

```text
C:\LibrarySystem\app\data\legacy-copy\
```

Run this command. Replace `library-school-final-YYYY-MM-DD.sql` with your backup's filename:

```powershell
pnpm --dir server import:legacy -- ..\data\legacy-copy\library-school-final-YYYY-MM-DD.sql
```

Wait for the import to finish. Do not run it against the live XAMPP database; the new system imports only the SQL backup file.

After the import, check with the librarian that the new system has the expected books, members, staff, active loans, reservations, and fines. If something does not match, stop and investigate before anyone uses the new system.

## Step 10: Configure Caddy

Create this file:

```text
C:\Caddy\Caddyfile
```

Copy this into it. Replace `library.example.edu` with the real library address from IT:

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

Caddy serves the website. It also sends API requests to the Node API, so users need only one address: `https://library.example.edu`.

## Step 11: Start the system for the first test

Open one PowerShell window and run:

```powershell
pnpm --dir C:\LibrarySystem\app\server start
```

Leave this window open.

Open a second PowerShell window as an administrator and run:

```powershell
caddy run --config C:\Caddy\Caddyfile
```

Leave this window open too.

Open this in a browser on the library computer:

```text
https://library.example.edu
```

If the page opens, test it from a different laptop and a phone connected to the library Wi-Fi.

## Step 12: Test the important actions

Before telling everyone to use the new system, test:

- staff login;
- member login;
- catalog search;
- borrow a copy;
- return a copy;
- make and receive a reservation;
- record a fine payment;
- create a manual backup;
- confirm the completed backup appears in Backup Manager and the `.sql` file exists in `C:\LibrarySystemData\backups`.

If a test fails, keep using the old XAMPP system while fixing the new one.

## Step 13: Make it start automatically

After the manual test works, ask IT to make both services start automatically when Windows starts:

- the Node API command from Step 10;
- Caddy using `C:\Caddy\Caddyfile`.

Do not rely on leaving PowerShell windows open forever. The full guide explains Windows service setup.

## Everyday use

Staff and students only need to open:

```text
https://library.example.edu
```

They can use a laptop, desktop, tablet, or phone as long as it is allowed to join the library network.

## If something goes wrong

1. Do not delete the database.
2. Keep the old XAMPP backup safe.
3. Check `C:\LibrarySystemData\logs`.
4. Check that MariaDB, Node API, and Caddy are running.
5. If the new system is not safe to use, stop new activity and return temporarily to the old system while you investigate.
