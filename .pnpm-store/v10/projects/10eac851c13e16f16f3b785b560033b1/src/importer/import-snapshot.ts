/**
 * Snapshot-only importer. It accepts a SQL dump copied into data/legacy-copy,
 * never accepts a connection string, and stages every parsed record before a
 * normalized write. It is intentionally conservative: malformed rows become
 * rejects, never guessed production records.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import crypto from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { prisma } from "../lib/prisma.js";
import { mapLegacyStatus, mappingVersion } from "../lib/status.js";

const root = resolve(process.cwd(), "..", "data", "legacy-copy");
const supported = new Set(["users", "admins", "books", "borrowings", "reservations", "fines", "writers", "publishers", "contributors", "corporates", "corporate_contributors", "publications"]);
type Row = Record<string, string | null>;

function unquote(value: string): string | null {
  const trimmed = value.trim();
  if (/^NULL$/i.test(trimmed)) return null;
  if (!trimmed.startsWith("'")) return trimmed;
  return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}
function values(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let item = ""; let quote = false; let escape = false; let depth = 0;
  for (const ch of input) {
    if (escape) { item += ch; escape = false; continue; }
    if (ch === "\\" && quote) { item += ch; escape = true; continue; }
    if (ch === "'") { quote = !quote; item += ch; continue; }
    if (!quote && ch === "(") { if (depth++ === 0) { row = []; item = ""; continue; } }
    if (!quote && ch === ")" && --depth === 0) { row.push(item); rows.push(row); item = ""; continue; }
    if (!quote && depth === 1 && ch === ",") { row.push(item); item = ""; continue; }
    if (depth > 0) item += ch;
  }
  return rows;
}
function parseDump(sql: string): Array<{ table: string; row: Row }> {
  const result: Array<{ table: string; row: Row }> = [];
  // A semicolon is valid inside a quoted title, summary, or contents field.
  // Find only statement terminators that occur outside quoted SQL literals.
  let start = 0;
  while ((start = sql.indexOf("INSERT INTO `", start)) !== -1) {
    let end = start; let quote = false; let escape = false;
    for (; end < sql.length; end++) {
      const ch = sql[end];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && quote) { escape = true; continue; }
      if (ch === "'") { quote = !quote; continue; }
      if (ch === ";" && !quote) break;
    }
    if (end === sql.length) break;
    const statement = sql.slice(start, end + 1);
    start = end + 1;
    const match = /^INSERT INTO `([^`]+)` \(([^)]+)\) VALUES\s*([\s\S]*);$/.exec(statement);
    if (!match) continue;
    const table = match[1]; if (!supported.has(table)) continue;
    const columns = match[2].split(",").map(column => column.trim().replaceAll("`", ""));
    for (const raw of values(match[3])) {
      if (raw.length !== columns.length) continue;
      result.push({ table, row: Object.fromEntries(columns.map((column, index) => [column, unquote(raw[index])])) });
    }
  }
  return result;
}
const nameOf = (row: Row) => [row.firstname, row.middle_init, row.lastname].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
// The legacy SQL stores an application-relative image path. Only a plain
// filename is retained; the cover-copy utility places that asset in v2's
// public/legacy-covers directory.
const coverImageOf = (row: Row) => {
  const source = row.front_image;
  if (!source) return null;
  const file = source.replaceAll("\\", "/").split("/").pop() ?? "";
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|gif)$/i.test(file) ? `/legacy-covers/${file}` : null;
};
const dateOf = (value: string | null) => {
  if (!value) return null;
  const normalized = value.includes(" ") ? `${value.replace(" ", "T")}Z` : `${value}T00:00:00.000Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};
async function batches<T>(rows: T[], action: (batch: T[]) => Promise<unknown>, size = 500) {
  for (let start = 0; start < rows.length; start += size) await action(rows.slice(start, start + size));
}

const pendingRejects: Array<{ runId: string; sourceTable: string; legacyId: string | null; reason: string; payload: Row }> = [];
async function flushRejects() {
  if (!pendingRejects.length) return;
  const rows = pendingRejects.splice(0, pendingRejects.length);
  await prisma.legacyImportReject.createMany({ data: rows });
}
async function reject(runId: string, table: string, row: Row, reason: string) {
  pendingRejects.push({ runId, sourceTable: table, legacyId: row.id, reason, payload: row });
  if (pendingRejects.length >= 500) await flushRejects();
}
async function recordMapping(entityType: string, legacy: string | null, target: string) {
  if (!legacy) return;
  await prisma.legacyStatusMapping.upsert({ where: { entityType_legacyValue_mappingVersion: { entityType, legacyValue: legacy, mappingVersion } }, update: {}, create: { id: crypto.randomUUID().replaceAll("-", "").slice(0, 30), entityType, legacyValue: legacy, targetValue: target, mappingVersion, reason: "Legacy snapshot status mapping" } });
}

const snapshot = process.argv[2];
if (!snapshot) throw new Error("Usage: pnpm import:legacy -- <file.sql>; the file must be inside data/legacy-copy.");
const absolute = resolve(snapshot);
if (!absolute.startsWith(root + "\\") && !absolute.startsWith(root + "/")) throw new Error("Only read-only snapshots inside data/legacy-copy are accepted.");
await readdir(root); // fails clearly when the approved snapshot directory is absent
const source = await readFile(absolute, "utf8");
await prisma.legacyImportRun.updateMany({ where: { status: "STAGING" }, data: { status: "ABANDONED", completedAt: new Date() } });
const run = await prisma.legacyImportRun.create({ data: { sourcePath: relative(root, absolute), sourceSha256: createHash("sha256").update(source).digest("hex"), status: "STAGING" } });
try {
  const parsed = parseDump(source);
  const stageRows = parsed.map(({ table, row }) => ({ runId: run.id, sourceTable: table, legacyId: row.id, payload: row }));
  for (let start = 0; start < stageRows.length; start += 500) {
    await prisma.legacyStageRow.createMany({ data: stageRows.slice(start, start + 500) });
  }
  const legacyBooks = parsed.filter(({ table }) => table === "books").map(({ row }) => row).filter(row => row.id && row.accession && row.title);
  for (const { row } of parsed.filter(({ table }) => table === "books")) {
    if (!row.id || !row.accession || !row.title) await reject(run.id, "books", row, "Book copy is missing an ID, accession number, or title.");
  }
  const titles = new Map<string, Row>();
  for (const row of legacyBooks) titles.set([row.title, row.ISBN, row.edition, row.program].map(value => value ?? "").join("|"), row);
  for (const status of new Set(legacyBooks.map(row => mapLegacyStatus("copy", row.status, "REPAIR").legacyStatus).filter((value): value is string => Boolean(value)))) {
    await recordMapping("copy", status, mapLegacyStatus("copy", status, "REPAIR").status);
  }
  const titleRows = [...titles].map(([legacyKey, row]) => ({ legacyKey, title: row.title!, preferredTitle: row.preferred_title, isbn: row.ISBN, subjectCategory: row.subject_category, program: row.program, summary: row.summary, contents: row.contents, coverImage: coverImageOf(row) }));
  for (let start = 0; start < titleRows.length; start += 500) await prisma.bookTitle.createMany({ data: titleRows.slice(start, start + 500), skipDuplicates: true });
  const titleByKey = new Map<string, string>();
  const titleByFoldedKey = new Map<string, string>();
  const titleKeys = [...titles.keys()];
  for (let start = 0; start < titleKeys.length; start += 500) {
    const found = await prisma.bookTitle.findMany({ where: { legacyKey: { in: titleKeys.slice(start, start + 500) } }, select: { id: true, legacyKey: true } });
    for (const title of found) if (title.legacyKey) {
      titleByKey.set(title.legacyKey, title.id);
      titleByFoldedKey.set(title.legacyKey.toLocaleLowerCase("en-US"), title.id);
    }
  }
  // Imports are intentionally idempotent, but a newly added cover path is
  // safe to backfill for already-imported legacy titles.
  for (const [key, row] of titles) {
    const coverImage = coverImageOf(row); const id = titleByKey.get(key);
    if (coverImage && id) await prisma.bookTitle.update({ where: { id }, data: { coverImage } });
  }
  // MariaDB's utf8mb4_unicode_ci unique index treats case variants as the
  // same legacy key, while a JavaScript Map does not.  Resolve the source key
  // with the same case-insensitive behavior before deciding a copy is orphaned.
  const titleIdFor = (key: string) => titleByKey.get(key) ?? titleByFoldedKey.get(key.toLocaleLowerCase("en-US"));
  const copyRows = legacyBooks.map(row => {
    const legacyKey = [row.title, row.ISBN, row.edition, row.program].map(value => value ?? "").join("|");
    const mapped = mapLegacyStatus("copy", row.status, "REPAIR");
    return { legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, legacyAccession: row.accession, accession: row.accession!, titleId: titleIdFor(legacyKey)!, copyNumber: row.copy_number ? Number(row.copy_number) : null, callNumber: row.call_number, shelfLocation: row.shelf_location, status: mapped.status as never, importedAt: new Date() };
  }).filter(row => Boolean(row.titleId));
  for (let start = 0; start < copyRows.length; start += 500) await prisma.copy.createMany({ data: copyRows.slice(start, start + 500), skipDuplicates: true });
  const legacyUsers = parsed.filter(({ table }) => table === "users").map(({ row }) => row).filter(row => row.id && nameOf(row));
  const legacyAdmins = parsed.filter(({ table }) => table === "admins").map(({ row }) => row).filter(row => row.id && nameOf(row));
  for (const status of new Set([...legacyUsers, ...legacyAdmins].map(row => row.status).filter((value): value is string => Boolean(value)))) {
    await recordMapping("member", status, mapLegacyStatus("member", status, "INACTIVE").status);
    await recordMapping("staff", status, mapLegacyStatus("staff", status, "INACTIVE").status);
  }
  const memberRows = legacyUsers.filter(row => (row.usertype ?? "").trim().toLowerCase() !== "staff").map(row => {
    const mapped = mapLegacyStatus("member", row.status, "INACTIVE");
    return { legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, schoolId: row.school_id, name: nameOf(row), email: row.email, passwordHash: row.password, program: row.department, memberType: row.usertype, phone: row.contact_no, status: mapped.status as never, importedAt: new Date() };
  });
  const staffRows = [...legacyAdmins.map(row => {
    const mapped = mapLegacyStatus("staff", row.status, "INACTIVE");
    return { legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, employeeId: row.employee_id, name: nameOf(row), email: row.email, passwordHash: row.password, role: row.role || "Staff", status: mapped.status as never, importedAt: new Date() };
  }), ...legacyUsers.filter(row => (row.usertype ?? "").trim().toLowerCase() === "staff").map(row => {
    const mapped = mapLegacyStatus("staff", row.status, "INACTIVE");
    return { legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, employeeId: row.school_id, name: nameOf(row), email: row.email, passwordHash: row.password, role: "Student Assistant", status: mapped.status as never, importedAt: new Date() };
  })];
  for (let start = 0; start < memberRows.length; start += 500) await prisma.member.createMany({ data: memberRows.slice(start, start + 500), skipDuplicates: true });
  for (let start = 0; start < staffRows.length; start += 500) await prisma.staff.createMany({ data: staffRows.slice(start, start + 500), skipDuplicates: true });

  // A legacy book row is a physical copy.  Some old accession numbers were
  // duplicated, so preserve the original in legacyAccession and give only the
  // canonical unique accession a deterministic suffix.
  const persistedCopies = await prisma.copy.findMany({ select: { id: true, legacyId: true, accession: true, titleId: true } });
  const copyByLegacyId = new Map(persistedCopies.filter(copy => copy.legacyId !== null).map(copy => [copy.legacyId!, copy]));
  const usedAccessions = new Set(persistedCopies.map(copy => copy.accession));
  for (const row of legacyBooks) {
    const legacyId = Number(row.id);
    if (copyByLegacyId.has(legacyId)) continue;
    const legacyKey = [row.title, row.ISBN, row.edition, row.program].map(value => value ?? "").join("|");
    const titleId = titleIdFor(legacyKey);
    if (!titleId) { await reject(run.id, "books", row, "No normalized title was created for this copy."); continue; }
    const mapped = mapLegacyStatus("copy", row.status, "REPAIR");
    let accession = row.accession!;
    if (usedAccessions.has(accession)) accession = `${accession}--legacy-${legacyId}`.slice(0, 64);
    try {
      const copy = await prisma.copy.create({ data: { legacyId, legacyStatus: mapped.legacyStatus, legacyAccession: row.accession, accession, titleId, copyNumber: row.copy_number ? Number(row.copy_number) : null, callNumber: row.call_number, shelfLocation: row.shelf_location, status: mapped.status as never, importedAt: new Date() }, select: { id: true, legacyId: true, accession: true, titleId: true } });
      copyByLegacyId.set(legacyId, copy); usedAccessions.add(accession);
    } catch (error) { await reject(run.id, "books", row, error instanceof Error ? error.message : "Could not import copy."); }
  }

  // Catalog authority records and their legacy IDs are imported before links.
  const writers = parsed.filter(({ table }) => table === "writers").map(({ row }) => row);
  const publishers = parsed.filter(({ table }) => table === "publishers").map(({ row }) => row);
  const corporates = parsed.filter(({ table }) => table === "corporates").map(({ row }) => row);
  await batches(writers.filter(row => row.id && row.firstname && row.lastname).map(row => ({ legacyId: Number(row.id), firstName: row.firstname!, middleInitial: row.middle_init, lastName: row.lastname!, displayName: nameOf(row) })), batch => prisma.author.createMany({ data: batch, skipDuplicates: true }));
  await batches(publishers.filter(row => row.id && row.publisher).map(row => ({ legacyId: Number(row.id), name: row.publisher!, place: row.place })), batch => prisma.publisher.createMany({ data: batch, skipDuplicates: true }));
  await batches(corporates.filter(row => row.id && row.name).map(row => ({ legacyId: Number(row.id), name: row.name!, type: row.type, location: row.location, description: row.description })), batch => prisma.corporateContributor.createMany({ data: batch, skipDuplicates: true }));
  for (const row of writers) if (!row.id || !row.firstname || !row.lastname) await reject(run.id, "writers", row, "Writer is missing an ID, first name, or last name.");
  for (const row of publishers) if (!row.id || !row.publisher) await reject(run.id, "publishers", row, "Publisher is missing an ID or name.");
  for (const row of corporates) if (!row.id || !row.name) await reject(run.id, "corporates", row, "Corporate contributor is missing an ID or name.");

  const [authors, persistedPublishers, persistedCorporates, members] = await Promise.all([
    prisma.author.findMany({ select: { id: true, legacyId: true } }), prisma.publisher.findMany({ select: { id: true, legacyId: true } }), prisma.corporateContributor.findMany({ select: { id: true, legacyId: true } }), prisma.member.findMany({ select: { id: true, legacyId: true } }),
  ]);
  const authorByLegacyId = new Map(authors.filter(author => author.legacyId !== null).map(author => [author.legacyId!, author.id]));
  const publisherByLegacyId = new Map(persistedPublishers.filter(publisher => publisher.legacyId !== null).map(publisher => [publisher.legacyId!, publisher.id]));
  const corporateByLegacyId = new Map(persistedCorporates.filter(corporate => corporate.legacyId !== null).map(corporate => [corporate.legacyId!, corporate.id]));
  const memberByLegacyId = new Map(members.filter(member => member.legacyId !== null).map(member => [member.legacyId!, member.id]));

  // Publications apply to a title through the physical-copy relationship. If
  // multiple old copy rows disagree, the first snapshot publication remains
  // canonical while every original row remains preserved in staging.
  const publicationByTitle = new Map<string, Row>();
  for (const { row } of parsed.filter(({ table }) => table === "publications")) {
    const copy = copyByLegacyId.get(Number(row.book_id));
    const publisherId = publisherByLegacyId.get(Number(row.publisher_id));
    if (!row.id || !copy || !publisherId) { await reject(run.id, "publications", row, "Publication refers to a missing copy or publisher."); continue; }
    if (!publicationByTitle.has(copy.titleId)) publicationByTitle.set(copy.titleId, row);
  }
  await batches([...publicationByTitle].map(([titleId, row]) => ({ titleId, publisherId: publisherByLegacyId.get(Number(row.publisher_id))!, publicationYear: row.publish_date ? Number(row.publish_date) : null })), async batch => {
    await Promise.all(batch.map(item => prisma.bookTitle.update({ where: { id: item.titleId }, data: { publisherId: item.publisherId, publicationYear: item.publicationYear } })));
  }, 25);

  const titleContributors = parsed.filter(({ table }) => table === "contributors" || table === "corporate_contributors");
  const contributorRows: Array<{ legacyId: number; legacySourceTable: string; titleId: string; authorId?: string; corporateId?: string; role: string }> = [];
  for (const { table, row } of titleContributors) {
    const copy = copyByLegacyId.get(Number(row.book_id));
    const partyId = table === "contributors" ? authorByLegacyId.get(Number(row.writer_id)) : corporateByLegacyId.get(Number(row.corporate_id));
    if (!row.id || !copy || !partyId) { await reject(run.id, table, row, "Contributor refers to a missing copy or authority record."); continue; }
    contributorRows.push({ legacyId: Number(row.id), legacySourceTable: table, titleId: copy.titleId, ...(table === "contributors" ? { authorId: partyId } : { corporateId: partyId }), role: row.role || "Contributor" });
  }
  await batches(contributorRows, batch => prisma.titleContributor.createMany({ data: batch, skipDuplicates: true }));

  const loans = parsed.filter(({ table }) => table === "borrowings").map(({ row }) => row);
  const loanRows: Array<{ legacyId: number; legacyStatus: string | null; memberId: string; copyId: string; status: never; issuedAt: Date; dueAt: Date; returnedAt: Date | null }> = [];
  for (const row of loans) {
    const memberId = memberByLegacyId.get(Number(row.user_id)); const copy = copyByLegacyId.get(Number(row.book_id));
    const issuedAt = dateOf(row.issue_date); const dueAt = dateOf(row.due_date); const returnedAt = dateOf(row.return_date);
    if (!row.id || !memberId || !copy || !issuedAt || !dueAt) { await reject(run.id, "borrowings", row, "Borrowing is missing a member, copy, issue date, or due date."); continue; }
    const mapped = mapLegacyStatus("loan", row.status, returnedAt ? "RETURNED" : "ACTIVE"); await recordMapping("loan", mapped.legacyStatus, mapped.status);
    loanRows.push({ legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, memberId, copyId: copy.id, status: mapped.status as never, issuedAt, dueAt, returnedAt });
  }
  await batches(loanRows, batch => prisma.loan.createMany({ data: batch, skipDuplicates: true }));
  const persistedLoans = await prisma.loan.findMany({ select: { id: true, legacyId: true } });
  const loanByLegacyId = new Map(persistedLoans.filter(loan => loan.legacyId !== null).map(loan => [loan.legacyId!, loan.id]));

  const reservationRows: Array<{ legacyId: number; legacyStatus: string | null; memberId: string; titleId: string; copyId: string; status: never; reservedAt: Date; readyAt: Date | null; receivedAt: Date | null; cancelledAt: Date | null }> = [];
  for (const { row } of parsed.filter(({ table }) => table === "reservations")) {
    const memberId = memberByLegacyId.get(Number(row.user_id)); const copy = copyByLegacyId.get(Number(row.book_id)); const reservedAt = dateOf(row.reserve_date);
    if (!row.id || !memberId || !copy || !reservedAt) { await reject(run.id, "reservations", row, "Reservation is missing a member, copy, or reservation date."); continue; }
    const mapped = mapLegacyStatus("reservation", row.status, "PENDING"); await recordMapping("reservation", mapped.legacyStatus, mapped.status);
    reservationRows.push({ legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, memberId, titleId: copy.titleId, copyId: copy.id, status: mapped.status as never, reservedAt, readyAt: dateOf(row.ready_date), receivedAt: dateOf(row.recieved_date), cancelledAt: dateOf(row.cancel_date) });
  }
  await batches(reservationRows, batch => prisma.reservation.createMany({ data: batch, skipDuplicates: true }));

  const fineRows: Array<{ legacyId: number; legacyStatus: string | null; loanId: string; amount: string; status: never; reason: string | null; assessedAt: Date; paidAt: Date | null }> = [];
  for (const { row } of parsed.filter(({ table }) => table === "fines")) {
    const loanId = loanByLegacyId.get(Number(row.borrowing_id)); const assessedAt = dateOf(row.date);
    if (!row.id || !loanId || !assessedAt || row.amount === null) { await reject(run.id, "fines", row, "Fine is missing a loan, assessment date, or amount."); continue; }
    const mapped = mapLegacyStatus("fine", row.status, "UNPAID"); await recordMapping("fine", mapped.legacyStatus, mapped.status);
    fineRows.push({ legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, loanId, amount: row.amount, status: mapped.status as never, reason: row.type, assessedAt, paidAt: dateOf(row.payment_date) });
  }
  await batches(fineRows, batch => prisma.fine.createMany({ data: batch, skipDuplicates: true }));

  for (const { table, row } of parsed) {
    try {
      if (!row.id) throw new Error("Missing legacy id.");
      if (table === "users") {
        // Valid users were bulk-imported before this validation loop.
        if (nameOf(row)) continue;
        if (!nameOf(row)) throw new Error("User is missing a name.");
        const legacyType = (row.usertype ?? "").trim().toLowerCase();
        if (legacyType === "staff") {
          const mapped = mapLegacyStatus("staff", row.status, "INACTIVE"); await recordMapping("staff", mapped.legacyStatus, mapped.status);
          await prisma.staff.upsert({ where: { legacyId: Number(row.id) }, update: {}, create: { legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, employeeId: row.school_id, name: nameOf(row), email: row.email, passwordHash: row.password, role: "Student Assistant", status: mapped.status as never, importedAt: new Date() } });
        } else {
          const mapped = mapLegacyStatus("member", row.status, "INACTIVE"); await recordMapping("member", mapped.legacyStatus, mapped.status);
          await prisma.member.upsert({ where: { legacyId: Number(row.id) }, update: {}, create: { legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, schoolId: row.school_id, name: nameOf(row), email: row.email, passwordHash: row.password, program: row.department, memberType: row.usertype, phone: row.contact_no, status: mapped.status as never, importedAt: new Date() } });
        }
      } else if (table === "admins") {
        // Valid staff accounts were bulk-imported before this validation loop.
        if (nameOf(row)) continue;
        if (!nameOf(row)) throw new Error("Staff account is missing a name.");
        const mapped = mapLegacyStatus("staff", row.status, "INACTIVE"); await recordMapping("staff", mapped.legacyStatus, mapped.status);
        await prisma.staff.upsert({ where: { legacyId: Number(row.id) }, update: {}, create: { legacyId: Number(row.id), legacyStatus: mapped.legacyStatus, employeeId: row.employee_id, name: nameOf(row), email: row.email, passwordHash: row.password, role: row.role || "Staff", status: mapped.status as never, importedAt: new Date() } });
      } else if (table === "books") {
        // Catalog rows were validated and bulk-inserted before account processing.
      }
    } catch (error) { await reject(run.id, table, row, error instanceof Error ? error.message : "Unknown import error."); }
  }
  await flushRejects();
  await prisma.legacyImportRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date() } });
} catch (error) {
  await flushRejects();
  await prisma.legacyImportRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date() } });
  throw error;
} finally { await prisma.$disconnect(); }
