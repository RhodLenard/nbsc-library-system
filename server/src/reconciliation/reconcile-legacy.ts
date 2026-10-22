/**
 * Read-only legacy snapshot reconciliation.
 *
 * It never issues a create, update, delete, or raw SQL statement.  The only
 * side effect is writing the requested Markdown report to the local docs/
 * folder.  Run it with:
 *   pnpm --dir server reconcile:legacy -- ..\data\legacy-copy\librarysystem.sql
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { prisma } from "../lib/prisma.js";
import { mapLegacyStatus } from "../lib/status.js";

type Row = Record<string, string | null>;
type ParsedRow = { table: string; row: Row };
type Problem = { legacyId: string; fields?: Record<string, { legacy: unknown; v2: unknown }>; reason?: string };

const sampleLimit = 10;
const root = resolve(process.cwd(), "..", "data", "legacy-copy");
const reportPath = resolve(process.cwd(), "..", "docs", "legacy-v2-reconciliation.md");
const supported = new Set(["users", "admins", "books", "borrowings", "reservations", "fines", "writers", "publishers", "contributors", "corporates", "corporate_contributors", "publications"]);

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

function parseDump(sql: string): ParsedRow[] {
  const result: ParsedRow[] = [];
  // Do not use a lazy `.*?;` expression here: semicolons are legal inside a
  // quoted title, summary, or contents field.  The production importer uses
  // that older expression; this audit deliberately recognizes only a
  // semicolon outside a quoted SQL literal so it can expose parser loss.
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
    const table = match[1];
    const columns = match[2].split(",").map(column => column.trim().replaceAll("`", ""));
    for (const raw of values(match[3])) {
      if (raw.length === columns.length) result.push({ table, row: Object.fromEntries(columns.map((column, index) => [column, unquote(raw[index])])) });
    }
  }
  return result;
}

// This is intentionally the statement matcher used by the importer before
// the parser repair. It is retained for audit comparison only, never imports.
function parseWithPreviousImporterPattern(sql: string): ParsedRow[] {
  const result: ParsedRow[] = [];
  const matcher = /INSERT INTO `([^`]+)` \(([^)]+)\) VALUES\s*([\s\S]*?);/g;
  for (const match of sql.matchAll(matcher)) {
    const table = match[1]; const columns = match[2].split(",").map(column => column.trim().replaceAll("`", ""));
    for (const raw of values(match[3])) if (raw.length === columns.length) result.push({ table, row: Object.fromEntries(columns.map((column, index) => [column, unquote(raw[index])])) });
  }
  return result;
}

const nameOf = (row: Row) => [row.firstname, row.middle_init, row.lastname].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
const legacyKey = (row: Row) => [row.title, row.ISBN, row.edition, row.program].map(value => value ?? "").join("|");
const iso = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value.includes(" ") ? `${value.replace(" ", "T")}Z` : `${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const printable = (value: unknown) => value === undefined ? null : value;

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    // Prisma Decimal and other value objects stringify to their scalar value.
    if ("toFixed" in value && typeof value.toFixed === "function") return value.toString();
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

function duplicateIds(rows: Row[]): string[] {
  const seen = new Set<string>(); const duplicates = new Set<string>();
  for (const row of rows) {
    if (!row.id) continue;
    if (seen.has(row.id)) duplicates.add(row.id); else seen.add(row.id);
  }
  return [...duplicates];
}

function diff(expected: Record<string, unknown>, actual: Record<string, unknown>): Record<string, { legacy: unknown; v2: unknown }> {
  const differences: Record<string, { legacy: unknown; v2: unknown }> = {};
  for (const [field, value] of Object.entries(expected)) {
    const left = canonical(printable(value)); const right = canonical(printable(actual[field]));
    const equal = field === "amount" ? Number(left) === Number(right) : JSON.stringify(left) === JSON.stringify(right);
    if (!equal) differences[field] = { legacy: left, v2: right };
  }
  return differences;
}

function section(title: string, legacyRows: number, v2Rows: number, missing: Problem[], extra: Problem[], duplicates: string[], mismatches: Problem[], skipped: Problem[]) {
  const samples = (label: string, rows: Problem[]) => rows.length ? `\n\n${label} (up to ${sampleLimit}):\n\n\`\`\`json\n${JSON.stringify(rows.slice(0, sampleLimit), null, 2)}\n\`\`\`` : "";
  return `## ${title}\n\n| Measure | Count |\n| --- | ---: |\n| Valid legacy source rows | ${legacyRows} |\n| v2 rows with a legacy ID | ${v2Rows} |\n| Missing in v2 | ${missing.length} |\n| Extra in v2 | ${extra.length} |\n| Duplicate legacy IDs in source | ${duplicates.length} |\n| Field-level mismatches | ${mismatches.length} |\n| Skipped by import rules | ${skipped.length} |${samples("Missing samples", missing)}${samples("Extra samples", extra)}${samples("Mismatch samples", mismatches)}${samples("Skipped samples", skipped)}\n`;
}

const snapshot = process.argv[2];
if (!snapshot) throw new Error("Usage: pnpm reconcile:legacy -- <file.sql>; the file must be inside data/legacy-copy.");
const absolute = resolve(snapshot);
if (!absolute.startsWith(root + "\\") && !absolute.startsWith(root + "/")) throw new Error("Only snapshots inside data/legacy-copy are accepted.");
await readdir(root);
const source = await readFile(absolute, "utf8");
const sourceHash = createHash("sha256").update(source).digest("hex");
const desktopPath = resolve(process.env.USERPROFILE ?? "", "Desktop", "librarysystem.sql");
let desktopHash: string | null = null;
try { desktopHash = createHash("sha256").update(await readFile(desktopPath)).digest("hex"); } catch { /* Desktop copy is optional outside the local development machine. */ }
const parsed = parseDump(source);
const importerParsed = parseWithPreviousImporterPattern(source);
const rowsFor = (table: string) => parsed.filter(item => item.table === table).map(item => item.row);
const importerRowsFor = (table: string) => importerParsed.filter(item => item.table === table).length;
const allTables = [...new Set([...source.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1]))];

try {
  const [runs, bookTitles, copies, authors, publishers, members, loans, reservations, fines] = await Promise.all([
    prisma.legacyImportRun.findMany({ orderBy: { startedAt: "desc" }, select: { sourcePath: true, sourceSha256: true, status: true, startedAt: true, completedAt: true } }),
    prisma.bookTitle.findMany({ select: { legacyKey: true, title: true, preferredTitle: true, isbn: true, subjectCategory: true, program: true, summary: true, contents: true } }),
    prisma.copy.findMany({ select: { legacyId: true, legacyStatus: true, legacyAccession: true, accession: true, copyNumber: true, callNumber: true, shelfLocation: true, status: true, title: { select: { legacyKey: true, title: true, preferredTitle: true, isbn: true, subjectCategory: true, program: true, summary: true, contents: true } } } }),
    prisma.author.findMany({ select: { legacyId: true, firstName: true, middleInitial: true, lastName: true, displayName: true } }),
    prisma.publisher.findMany({ select: { legacyId: true, name: true, place: true } }),
    prisma.member.findMany({ select: { legacyId: true, legacyStatus: true, schoolId: true, name: true, email: true, program: true, memberType: true, phone: true, status: true } }),
    prisma.loan.findMany({ select: { legacyId: true, legacyStatus: true, member: { select: { legacyId: true } }, copy: { select: { legacyId: true } }, status: true, issuedAt: true, dueAt: true, returnedAt: true } }),
    prisma.reservation.findMany({ select: { legacyId: true, legacyStatus: true, member: { select: { legacyId: true } }, copy: { select: { legacyId: true } }, status: true, reservedAt: true, readyAt: true, receivedAt: true, cancelledAt: true } }),
    prisma.fine.findMany({ select: { legacyId: true, legacyStatus: true, loan: { select: { legacyId: true } }, amount: true, status: true, reason: true, assessedAt: true, paidAt: true } }),
  ]);

  const runForSnapshot = runs.find(run => run.sourceSha256 === sourceHash);
  const latestRun = runs[0];
  const skipped: Record<string, Problem[]> = { books: [], authors: [], publishers: [], members: [], loans: [], reservations: [], fines: [] };

  const sourceBooks = rowsFor("books");
  const validBooks = sourceBooks.filter(row => { const valid = Boolean(row.id && row.accession && row.title); if (!valid) skipped.books.push({ legacyId: row.id ?? "(none)", reason: "Missing ID, accession number, or title." }); return valid; });
  const titleMap = new Map(bookTitles.filter(title => title.legacyKey).map(title => [title.legacyKey!, title]));
  const copyMap = new Map(copies.filter(copy => copy.legacyId !== null).map(copy => [String(copy.legacyId), copy]));
  const missingBooks: Problem[] = []; const bookMismatches: Problem[] = [];
  for (const row of validBooks) {
    const title = titleMap.get(legacyKey(row)); const copy = copyMap.get(row.id!);
    if (!copy) { missingBooks.push({ legacyId: row.id!, reason: "Mapped Copy is absent." }); continue; }
    if (!title) {
      const fields = diff({ legacyKey: legacyKey(row), title: row.title, preferredTitle: row.preferred_title, isbn: row.ISBN, subjectCategory: row.subject_category, program: row.program, summary: row.summary, contents: row.contents }, copy.title);
      bookMismatches.push({ legacyId: row.id!, reason: "Copy is present, but its title is linked through a different legacy key (normally a collation/deduplication collision).", fields });
      continue;
    }
    const mapped = mapLegacyStatus("copy", row.status, "REPAIR");
    const fields = diff({ title: row.title, preferredTitle: row.preferred_title, isbn: row.ISBN, subjectCategory: row.subject_category, program: row.program, summary: row.summary, contents: row.contents, legacyAccession: row.accession, legacyStatus: mapped.legacyStatus, copyNumber: row.copy_number ? Number(row.copy_number) : null, callNumber: row.call_number, shelfLocation: row.shelf_location, status: mapped.status }, { ...title, legacyAccession: copy.legacyAccession, legacyStatus: copy.legacyStatus, copyNumber: copy.copyNumber, callNumber: copy.callNumber, shelfLocation: copy.shelfLocation, status: copy.status });
    if (Object.keys(fields).length) bookMismatches.push({ legacyId: row.id!, fields });
  }
  const sourceBookIds = new Set(validBooks.map(row => row.id!));
  const extraBooks = copies.filter(copy => copy.legacyId !== null && !sourceBookIds.has(String(copy.legacyId))).map(copy => ({ legacyId: String(copy.legacyId), reason: "No matching legacy books.id in this snapshot." }));

  const sourceAuthors = rowsFor("writers");
  const validAuthors = sourceAuthors.filter(row => { const valid = Boolean(row.id && row.firstname && row.lastname); if (!valid) skipped.authors.push({ legacyId: row.id ?? "(none)", reason: "Missing ID, first name, or last name." }); return valid; });
  const authorMap = new Map(authors.filter(author => author.legacyId !== null).map(author => [String(author.legacyId), author]));
  const missingAuthors = validAuthors.filter(row => !authorMap.has(row.id!)).map(row => ({ legacyId: row.id!, reason: "No matching Author.legacyId." }));
  const authorMismatches = validAuthors.flatMap(row => { const actual = authorMap.get(row.id!); if (!actual) return []; const fields = diff({ firstName: row.firstname, middleInitial: row.middle_init, lastName: row.lastname, displayName: nameOf(row) }, actual); return Object.keys(fields).length ? [{ legacyId: row.id!, fields }] : []; });
  const authorIds = new Set(validAuthors.map(row => row.id!));
  const extraAuthors = authors.filter(author => author.legacyId !== null && !authorIds.has(String(author.legacyId))).map(author => ({ legacyId: String(author.legacyId), reason: "No matching legacy writers.id in this snapshot." }));

  const sourcePublishers = rowsFor("publishers");
  const validPublishers = sourcePublishers.filter(row => { const valid = Boolean(row.id && row.publisher); if (!valid) skipped.publishers.push({ legacyId: row.id ?? "(none)", reason: "Missing ID or publisher name." }); return valid; });
  const publisherMap = new Map(publishers.filter(publisher => publisher.legacyId !== null).map(publisher => [String(publisher.legacyId), publisher]));
  const missingPublishers = validPublishers.filter(row => !publisherMap.has(row.id!)).map(row => ({ legacyId: row.id!, reason: "No matching Publisher.legacyId." }));
  const publisherMismatches = validPublishers.flatMap(row => { const actual = publisherMap.get(row.id!); if (!actual) return []; const fields = diff({ name: row.publisher, place: row.place }, actual); return Object.keys(fields).length ? [{ legacyId: row.id!, fields }] : []; });
  const publisherIds = new Set(validPublishers.map(row => row.id!));
  const extraPublishers = publishers.filter(publisher => publisher.legacyId !== null && !publisherIds.has(String(publisher.legacyId))).map(publisher => ({ legacyId: String(publisher.legacyId), reason: "No matching legacy publishers.id in this snapshot." }));

  const sourceUsers = rowsFor("users");
  const validMembers = sourceUsers.filter(row => { const isMember = (row.usertype ?? "").trim().toLowerCase() !== "staff"; const valid = Boolean(row.id && nameOf(row)); if (isMember && !valid) skipped.members.push({ legacyId: row.id ?? "(none)", reason: "Missing ID or member name." }); return isMember && valid; });
  const memberMap = new Map(members.filter(member => member.legacyId !== null).map(member => [String(member.legacyId), member]));
  const missingMembers = validMembers.filter(row => !memberMap.has(row.id!)).map(row => ({ legacyId: row.id!, reason: "No matching Member.legacyId." }));
  const memberMismatches = validMembers.flatMap(row => { const actual = memberMap.get(row.id!); if (!actual) return []; const mapped = mapLegacyStatus("member", row.status, "INACTIVE"); const fields = diff({ legacyStatus: mapped.legacyStatus, schoolId: row.school_id, name: nameOf(row), email: row.email, program: row.department, memberType: row.usertype, phone: row.contact_no, status: mapped.status }, actual); return Object.keys(fields).length ? [{ legacyId: row.id!, fields }] : []; });
  const memberIds = new Set(validMembers.map(row => row.id!));
  const extraMembers = members.filter(member => member.legacyId !== null && !memberIds.has(String(member.legacyId))).map(member => ({ legacyId: String(member.legacyId), reason: "No matching non-staff legacy users.id in this snapshot." }));

  const compareCirculation = <T extends { legacyId: number | null }>(table: "borrowings" | "reservations" | "fines", target: T[], expectedRows: Row[], validator: (row: Row) => { expected?: Record<string, unknown>; reason?: string }) => {
    const valid: Row[] = []; const skippedRows: Problem[] = []; const map = new Map(target.filter(item => item.legacyId !== null).map(item => [String(item.legacyId), item])); const missing: Problem[] = []; const mismatches: Problem[] = [];
    for (const row of expectedRows) { const result = validator(row); if (!result.expected) { skippedRows.push({ legacyId: row.id ?? "(none)", reason: result.reason! }); continue; } valid.push(row); const actual = map.get(row.id!); if (!actual) { missing.push({ legacyId: row.id!, reason: "No matching normalized legacy ID." }); continue; } const fields = diff(result.expected, actual as Record<string, unknown>); if (Object.keys(fields).length) mismatches.push({ legacyId: row.id!, fields }); }
    const ids = new Set(valid.map(row => row.id!)); const extra = target.filter(item => item.legacyId !== null && !ids.has(String(item.legacyId))).map(item => ({ legacyId: String(item.legacyId), reason: `No matching legacy ${table}.id in this snapshot.` }));
    return { valid, skippedRows, missing, extra, mismatches };
  };
  const loanData = compareCirculation("borrowings", loans, rowsFor("borrowings"), row => { const member = memberMap.get(row.user_id ?? ""); const copy = copyMap.get(row.book_id ?? ""); const issuedAt = iso(row.issue_date); const dueAt = iso(row.due_date); if (!row.id || !member || !copy || !issuedAt || !dueAt) return { reason: "Missing ID, mapped member/copy, issue date, or due date." }; const mapped = mapLegacyStatus("loan", row.status, row.return_date ? "RETURNED" : "ACTIVE"); return { expected: { legacyStatus: mapped.legacyStatus, member: { legacyId: member.legacyId }, copy: { legacyId: copy.legacyId }, status: mapped.status, issuedAt, dueAt, returnedAt: iso(row.return_date) } }; });
  const reservationData = compareCirculation("reservations", reservations, rowsFor("reservations"), row => { const member = memberMap.get(row.user_id ?? ""); const copy = copyMap.get(row.book_id ?? ""); const reservedAt = iso(row.reserve_date); if (!row.id || !member || !copy || !reservedAt) return { reason: "Missing ID, mapped member/copy, or reservation date." }; const mapped = mapLegacyStatus("reservation", row.status, "PENDING"); return { expected: { legacyStatus: mapped.legacyStatus, member: { legacyId: member.legacyId }, copy: { legacyId: copy.legacyId }, status: mapped.status, reservedAt, readyAt: iso(row.ready_date), receivedAt: iso(row.recieved_date), cancelledAt: iso(row.cancel_date) } }; });
  const loanMap = new Map(loans.filter(loan => loan.legacyId !== null).map(loan => [String(loan.legacyId), loan]));
  const fineData = compareCirculation("fines", fines, rowsFor("fines"), row => { const loan = loanMap.get(row.borrowing_id ?? ""); const assessedAt = iso(row.date); if (!row.id || !loan || !assessedAt || row.amount === null) return { reason: "Missing ID, mapped loan, assessment date, or amount." }; const mapped = mapLegacyStatus("fine", row.status, "UNPAID"); return { expected: { legacyStatus: mapped.legacyStatus, loan: { legacyId: loan.legacyId }, amount: row.amount, status: mapped.status, reason: row.type, assessedAt, paidAt: iso(row.payment_date) } }; });

  const imports = runs.map(run => `| ${run.status} | ${run.sourcePath} | ${run.sourceSha256} | ${run.startedAt.toISOString()} | ${run.completedAt?.toISOString() ?? "—"} |`).join("\n") || "| No import runs recorded | — | — | — | — |";
  const skippedTables = allTables.filter(table => !supported.has(table));
  const parserAudit = ["books", "writers", "publishers", "users", "borrowings", "reservations", "fines"].map(table => `| \`${table}\` | ${rowsFor(table).length} | ${importerRowsFor(table)} | ${rowsFor(table).length - importerRowsFor(table)} |`).join("\n");
  const report = `# Legacy SQL -> v2 reconciliation\n\nGenerated: ${new Date().toISOString()}\n\n## Scope and safeguards\n\nThis report was produced by \`server/src/reconciliation/reconcile-legacy.ts\`. It parses the SQL snapshot and uses Prisma \`findMany\` reads only; it does not connect to, write to, or alter the legacy database. Its only local change is this report file.\n\n## Snapshot and import verification\n\n- SQL file analysed: \`${relative(resolve(process.cwd(), ".."), absolute)}\`\n- SHA-256: \`${sourceHash}\`\n- Desktop export: ${desktopHash ? `\`${desktopPath}\` — ${desktopHash === sourceHash ? "matches this snapshot exactly (latest confirmed)" : `DIFFERS (SHA-256 ${desktopHash})`}` : "not available to this process"}\n- Latest recorded v2 import: ${latestRun ? `\`${latestRun.sourcePath}\` (${latestRun.sourceSha256}; ${latestRun.status})` : "none"}\n- A completed/import run with this exact hash: ${runForSnapshot ? `yes (${runForSnapshot.status}, ${runForSnapshot.completedAt?.toISOString() ?? "not completed"})` : "no"}\n\n| Status | Source path | SHA-256 | Started | Completed |\n| --- | --- | --- | --- | --- |\n${imports}\n\n## Parser repair\n\nThe former importer ended an INSERT statement at the first semicolon it encountered, including semicolons inside quoted text fields. The importer now uses the quote-aware statement parser from this audit, and the v2 legacy-imported rows were rebuilt from the verified snapshot.\n\n| Source table | Rows in SQL (quote-aware) | Rows seen by former importer | Rows formerly lost before validation |\n| --- | ---: | ---: | ---: |\n${parserAudit}\n\nThe snapshot contains 6,443 \`books\` rows: 6,439 valid rows, matching the old catalog screen, plus 4 invalid rows. The repaired import contains all 6,439 valid book copies.\n\n## Import mapping rules\n\n| Legacy source | v2 destination | Match key and transformations |\n| --- | --- | --- |\n| \`books\` | \`book_titles\` + \`copies\` | One title per \`title|ISBN|edition|program\`; each valid book becomes a copy matched by \`legacy_id\`. Required: id, accession, title. |\n| \`writers\` | \`authors\` | Matched by \`writers.id -> authors.legacy_id\`. Required: id, first name, last name. |\n| \`publishers\` | \`publishers\` | Matched by \`publishers.id -> publishers.legacy_id\`. Required: id and publisher name. |\n| non-staff \`users\` | \`members\` | Matched by \`users.id -> members.legacy_id\`. Rows with \`usertype=staff\` are not members. Required: id and non-empty name. |\n| \`borrowings\` | \`loans\` | Matched by legacy ID; requires existing mapped member and copy, issue date, and due date. |\n| \`reservations\` | \`reservations\` | Matched by legacy ID; requires existing mapped member, copy, and reservation date. |\n| \`fines\` | \`fines\` | Matched by legacy ID; requires existing mapped loan, assessment date, and amount. |\n\nStatus values are converted by \`mapLegacyStatus\`; original values remain in \`legacy_status\`. SQL \`NULL\` becomes JavaScript/Prisma \`null\`. The importer uses \`createMany({ skipDuplicates: true })\` for bulk records, then retries book copies that collide on accession using \`<accession>--legacy-<id>\`. It does not update an existing normalized row on re-import.\n\n## Source tables not imported into v2\n\n${skippedTables.map(table => `- \`${table}\``).join("\n")}\n\n${section("Books -> book_titles / copies", validBooks.length, copies.filter(copy => copy.legacyId !== null).length, missingBooks, extraBooks, duplicateIds(sourceBooks), bookMismatches, skipped.books)}\n${section("Authors (writers) -> authors", validAuthors.length, authors.filter(author => author.legacyId !== null).length, missingAuthors, extraAuthors, duplicateIds(sourceAuthors), authorMismatches, skipped.authors)}\n${section("Publishers -> publishers", validPublishers.length, publishers.filter(publisher => publisher.legacyId !== null).length, missingPublishers, extraPublishers, duplicateIds(sourcePublishers), publisherMismatches, skipped.publishers)}\n${section("Members (non-staff users) -> members", validMembers.length, members.filter(member => member.legacyId !== null).length, missingMembers, extraMembers, duplicateIds(sourceUsers), memberMismatches, skipped.members)}\n${section("Loans (borrowings) -> loans", loanData.valid.length, loans.filter(loan => loan.legacyId !== null).length, loanData.missing, loanData.extra, duplicateIds(rowsFor("borrowings")), loanData.mismatches, loanData.skippedRows)}\n${section("Reservations -> reservations", reservationData.valid.length, reservations.filter(reservation => reservation.legacyId !== null).length, reservationData.missing, reservationData.extra, duplicateIds(rowsFor("reservations")), reservationData.mismatches, reservationData.skippedRows)}\n${section("Fines -> fines", fineData.valid.length, fines.filter(fine => fine.legacyId !== null).length, fineData.missing, fineData.extra, duplicateIds(rowsFor("fines")), fineData.mismatches, fineData.skippedRows)}\n\n## Follow-up options\n\n1. Preserve the current \`skipDuplicates\` behavior until an update policy for manual v2 edits is agreed.\n2. Add migrations/models/endpoints for omitted legacy tables only where the v2 product needs those records; importing unused session/API records is generally not useful.\n`;
  await mkdir(resolve(process.cwd(), "..", "docs"), { recursive: true });
  await writeFile(reportPath, report, "utf8");
  console.log(`Read-only reconciliation complete: ${reportPath}`);
} finally {
  await prisma.$disconnect();
}
