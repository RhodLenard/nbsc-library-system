import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "./prisma.js";
import { recordAudit } from "./audit.js";

const execFileAsync = promisify(execFile);
const backupDir = process.env.BACKUP_DIR;

function databaseArgs() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  return { host: url.hostname, port: url.port || "3306", user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.replace(/^\//, "") };
}

function configuredBackupDirectory() {
  if (!backupDir || !path.isAbsolute(backupDir)) throw new Error("BACKUP_DIR must be an absolute path on an external backup mount.");
  const applicationDir = path.resolve(process.cwd());
  if (path.resolve(backupDir).startsWith(applicationDir + path.sep)) throw new Error("BACKUP_DIR must be outside the application directory.");
  return backupDir;
}

export async function runBackup(kind: "AUTOMATIC" | "MANUAL" = "AUTOMATIC") {
  const run = await prisma.backupRun.create({ data: { status: "RUNNING", kind } });
  let filePath = "";
  try {
    const directory = configuredBackupDirectory();
    filePath = path.join(directory, `library-v2-${run.startedAt.toISOString().replace(/[:.]/g, "-")}.sql`);
    await fs.mkdir(directory, { recursive: true });
    const db = databaseArgs();
    await execFileAsync(process.env.MARIADB_DUMP_BIN ?? "mariadb-dump", ["--single-transaction", "--routines", "--events", "--host", db.host, "--port", db.port, "--user", db.user, `--password=${db.password}`, db.database], { maxBuffer: 1024 * 1024 * 512 }).then(result => fs.writeFile(filePath, result.stdout));
    const stat = await fs.stat(filePath);
    const checksum = await new Promise<string>((resolve, reject) => { const hash = crypto.createHash("sha256"); const stream = createReadStream(filePath); stream.on("data", chunk => { hash.update(chunk); }); stream.on("error", reject); stream.on("end", () => resolve(hash.digest("hex"))); });
    const verify = await fs.readFile(filePath); const verified = crypto.createHash("sha256").update(verify).digest("hex") === checksum;
    if (!verified) throw new Error("Backup checksum verification failed.");
    const result = await prisma.backupRun.update({ where: { id: run.id }, data: { status: "VERIFIED", completedAt: new Date(), verifiedAt: new Date(), checksum, sizeBytes: BigInt(stat.size), filePath } });
    await recordAudit({ action: "BACKUP_COMPLETED", targetType: "BACKUP_RUN", targetId: result.id, afterData: { kind, checksum, sizeBytes: stat.size } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 4000) : "Backup failed.";
    const result = await prisma.backupRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), error: message } });
    await recordAudit({ action: "BACKUP_FAILED", targetType: "BACKUP_RUN", targetId: result.id, afterData: { kind } });
    return result;
  }
}

export async function restoreBackupToTestDatabase(runId: string) {
  const run = await prisma.backupRun.findUnique({ where: { id: runId } });
  if (!run?.filePath || run.status !== "VERIFIED" || !run.checksum) throw new Error("Only a verified backup with a stored file can be restored.");
  const targetUrl = process.env.BACKUP_RESTORE_TEST_DATABASE_URL;
  if (!targetUrl) throw new Error("BACKUP_RESTORE_TEST_DATABASE_URL is required for a clean-database restore test.");
  const source = databaseArgs(); const target = new URL(targetUrl);
  if (target.hostname === source.host && (target.port || "3306") === source.port && target.pathname.replace(/^\//, "") === source.database) throw new Error("Restore tests cannot target the live library database.");
  const actualChecksum = crypto.createHash("sha256").update(await fs.readFile(run.filePath)).digest("hex");
  if (actualChecksum !== run.checksum) throw new Error("Backup checksum no longer matches; restore refused.");
  const dump = await fs.readFile(run.filePath);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.env.MARIADB_BIN ?? "mariadb", ["--host", target.hostname, "--port", target.port || "3306", "--user", decodeURIComponent(target.username), `--password=${decodeURIComponent(target.password)}`, target.pathname.replace(/^\//, "")], { stdio: ["pipe", "ignore", "pipe"] });
    let error = ""; child.stderr.on("data", (chunk: Buffer) => { error += String(chunk); });
    child.on("error", reject); child.on("close", (code: number | null) => code === 0 ? resolve() : reject(new Error(error || `MariaDB restore exited with code ${code}.`)));
    child.stdin.end(dump);
  });
  return { runId, targetDatabase: target.pathname.replace(/^\//, "") };
}
