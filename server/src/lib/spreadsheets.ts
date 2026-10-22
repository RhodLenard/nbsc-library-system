import * as XLSX from "xlsx";

export type ImportRow = Record<string, string>;

const normalise = (value: unknown) => String(value ?? "").trim();

export function readSpreadsheet(input: { format: "csv" | "xlsx"; contentBase64: string }): ImportRow[] {
  const bytes = Buffer.from(input.contentBase64, "base64");
  const workbook = XLSX.read(bytes, { type: "buffer", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The uploaded file has no worksheet.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const [header = [], ...data] = rows;
  const keys = header.map(value => normalise(value).toLowerCase());
  if (!keys.some(Boolean)) throw new Error("The first row must contain column headers.");
  return data.filter(row => row.some(value => normalise(value))).map(row => Object.fromEntries(keys.map((key, index) => [key, normalise(row[index])])));
}

export function workbookDownload(rows: Record<string, unknown>[], format: "csv" | "xlsx", sheetName: string) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: format === "xlsx" ? "xlsx" : "csv" });
}
