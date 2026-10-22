/** Copies only SQL-referenced legacy cover files into the v2 public folder. */
import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const snapshot = process.argv[2];
if (!snapshot) throw new Error("Usage: pnpm copy:legacy-covers -- <file.sql>");
const source = await readFile(resolve(snapshot), "utf8");
const legacyDirectory = resolve(process.env.LEGACY_BOOK_IMAGE_DIR ?? "C:/xampp/htdocs/Library-System/Images/book-image");
const destination = resolve(process.cwd(), "..", "public", "legacy-covers");

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
function unquote(value: string): string | null {
  const trimmed = value.trim(); if (/^NULL$/i.test(trimmed)) return null;
  return trimmed.startsWith("'") ? trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\") : trimmed;
}

const files = new Set<string>(); let start = 0;
while ((start = source.indexOf("INSERT INTO `books`", start)) !== -1) {
  let end = start; let quote = false; let escape = false;
  for (; end < source.length; end++) { const ch = source[end]; if (escape) { escape = false; continue; } if (ch === "\\" && quote) { escape = true; continue; } if (ch === "'") { quote = !quote; continue; } if (ch === ";" && !quote) break; }
  const statement = source.slice(start, end + 1); start = end + 1;
  const match = /^INSERT INTO `books` \(([^)]+)\) VALUES\s*([\s\S]*);$/.exec(statement); if (!match) continue;
  const columns = match[1].split(",").map(column => column.trim().replaceAll("`", "")); const front = columns.indexOf("front_image");
  for (const row of values(match[2])) { const path = front < 0 ? null : unquote(row[front]); if (path) { const file = basename(path.replaceAll("\\", "/")); if (/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|gif)$/i.test(file)) files.add(file); } }
}
await mkdir(destination, { recursive: true });
let copied = 0; let missing = 0;
for (const file of files) {
  try { await access(resolve(legacyDirectory, file)); await copyFile(resolve(legacyDirectory, file), resolve(destination, file)); copied++; } catch { missing++; }
}
console.log(JSON.stringify({ referenced: files.size, copied, missing, destination }, null, 2));
