import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { allowStaff, requireAuth } from "../lib/auth.js";
import { idempotent } from "../lib/idempotency.js";
import { auditRequest } from "../lib/audit.js";
import { readSpreadsheet, workbookDownload } from "../lib/spreadsheets.js";

export const catalogRouter = Router();
const copyInput = z.object({ id: z.string().optional(), accession: z.string().trim().min(1).max(64), copyNo: z.number().int().positive(), location: z.string().trim().max(100).optional(), callNo: z.string().trim().max(255).optional(), status: z.enum(["AVAILABLE", "ON_LOAN", "RESERVED", "LOST", "DAMAGED", "REPLACED", "REPAIR"]).default("AVAILABLE") });
const PROGRAMS = ["BSCS", "BSA", "BSAIS", "BSE", "BSTM"] as const;
const bookInput = z.object({ title: z.string().trim().min(1).max(500), preferredTitle: z.string().trim().max(500).optional(), isbn: z.string().trim().max(100).optional(), subjectCategory: z.string().trim().max(100).optional(), program: z.enum(PROGRAMS).optional(), summary: z.string().optional(), contents: z.string().optional(), publisherId: z.string().nullable().optional(), year: z.string().regex(/^\d{4}$/).optional(), contributors: z.array(z.object({ writerId: z.string(), role: z.string().trim().min(1).max(100) })).default([]), corporate: z.array(z.object({ corpId: z.string(), role: z.string().trim().min(1).max(100) })).default([]), copies: z.array(copyInput).min(1) });
const sheetInput = z.object({ format: z.enum(["csv", "xlsx"]), contentBase64: z.string().min(1).max(40_000_000) });
const column = (row: Record<string, string>, ...names: string[]) => names.map(name => row[name]).find(value => value !== undefined)?.trim() ?? "";
catalogRouter.get("/books", async (req, res, next) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(Number(req.query.pageSize ?? 24) || 24, 100));
    const category = String(req.query.category ?? "").trim();
    const program = String(req.query.program ?? "").trim();
    const available = String(req.query.available ?? "") === "true";
    const sort = String(req.query.sort ?? "title");
    const where = {
      ...(search ? { OR: [{ title: { contains: search } }, { isbn: { contains: search } }, { preferredTitle: { contains: search } }] } : {}),
      ...(category ? { subjectCategory: category } : {}),
      ...(program ? { program } : {}),
      ...(available ? { copies: { some: { status: "AVAILABLE" as const } } } : {}),
    };
    const [total, items] = await prisma.$transaction([
      prisma.bookTitle.count({ where }),
      prisma.bookTitle.findMany({
        where, select: { id: true, title: true, preferredTitle: true, isbn: true, subjectCategory: true, program: true, summary: true, _count: { select: { copies: { where: { status: "AVAILABLE" } } } } }, orderBy: sort === "year" ? { publicationYear: "desc" } : sort === "new" ? { createdAt: "desc" } : { title: "asc" }, skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    res.json({ data: {
      items: items.map(({ _count, ...book }) => ({ ...book, availableCopies: _count.copies })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    } });
  } catch (error) { next(error); }
});
catalogRouter.get("/books/:id", async (req, res, next) => {
  try {
    const book = await prisma.bookTitle.findUnique({ where: { id: req.params.id }, include: { copies: { select: { accession: true, status: true, shelfLocation: true } } } });
    if (!book) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Book not found." } });
    res.json({ data: book });
  } catch (error) { next(error); }
});

catalogRouter.get("/export", requireAuth, allowStaff(), async (req, res, next) => {
  try {
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";
    const titles = await prisma.bookTitle.findMany({ include: { copies: true, publisher: true, contributors: { include: { author: true } } }, orderBy: { title: "asc" } });
    const rows = titles.flatMap(book => book.copies.map(copy => ({ Title: book.title, "Preferred title": book.preferredTitle ?? "", ISBN: book.isbn ?? "", Author: book.contributors.map(item => item.author?.displayName).filter(Boolean).join("; "), Publisher: book.publisher?.name ?? "", Year: book.publicationYear ?? "", Category: book.subjectCategory ?? "", Program: book.program ?? "", Accession: copy.accession, "Copy number": copy.copyNumber ?? "", "Call number": copy.callNumber ?? "", Location: copy.shelfLocation ?? "", Status: copy.status })));
    const content = workbookDownload(rows, format, "Catalog");
    res.type(format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv");
    res.attachment(`catalog-export.${format}`); res.send(content);
  } catch (error) { next(error); }
});

catalogRouter.post("/import", requireAuth, allowStaff(), auditRequest("CATALOG_IMPORT"), idempotent, async (req, res, next) => {
  try {
    const rows = readSpreadsheet(sheetInput.parse(req.body));
    const rejected: { row: number; reason: string }[] = []; let imported = 0;
    await prisma.$transaction(async tx => {
      for (const [index, row] of rows.entries()) {
        const title = column(row, "title", "book title"); const accession = column(row, "accession", "accession no", "accession no.", "acc #");
        if (!title || !accession) { rejected.push({ row: index + 2, reason: "Title and accession are required." }); continue; }
        const program = column(row, "program");
        if (program && !(PROGRAMS as readonly string[]).includes(program)) { rejected.push({ row: index + 2, reason: `Program must be one of: ${PROGRAMS.join(", ")}.` }); continue; }
        if (await tx.copy.findUnique({ where: { accession }, select: { id: true } })) { rejected.push({ row: index + 2, reason: `Accession ${accession} already exists.` }); continue; }
        const authorName = column(row, "author", "writer"); const publisherName = column(row, "publisher");
        const publisher = publisherName ? await tx.publisher.findFirst({ where: { name: publisherName }, select: { id: true } }) ?? await tx.publisher.create({ data: { name: publisherName }, select: { id: true } }) : null;
        const book = await tx.bookTitle.create({ data: { title, isbn: column(row, "isbn", "isbn-13") || null, subjectCategory: column(row, "category", "subject") || null, program: program || null, publisherId: publisher?.id, publicationYear: /^\d{4}$/.test(column(row, "year", "pub year")) ? Number(column(row, "year", "pub year")) : null } });
        if (authorName) { const parts = authorName.split(/\s+/); const author = await tx.author.create({ data: { firstName: parts[0] ?? authorName, lastName: parts.slice(1).join(" ") || parts[0] || authorName, displayName: authorName } }); await tx.titleContributor.create({ data: { titleId: book.id, authorId: author.id, role: "Author", legacySourceTable: "v2-import" } }); }
        await tx.copy.create({ data: { titleId: book.id, accession, copyNumber: Number(column(row, "copy number", "copy no")) || 1, callNumber: column(row, "call number", "call no", "callno") || null, shelfLocation: column(row, "location", "shelf") || null } }); imported++;
      }
    });
    res.status(201).json({ data: { imported, rejected } });
  } catch (error) { next(error); }
});

catalogRouter.post("/books", requireAuth, allowStaff(), auditRequest("CATALOG_EDIT"), idempotent, async (req, res, next) => {
  try {
    const data = bookInput.parse(req.body);
    const book = await prisma.$transaction(async tx => {
      const title = await tx.bookTitle.create({ data: { title: data.title, preferredTitle: data.preferredTitle || null, isbn: data.isbn || null, subjectCategory: data.subjectCategory || null, program: data.program || null, summary: data.summary || null, contents: data.contents || null, publisherId: data.publisherId || null, publicationYear: data.year ? Number(data.year) : null } });
      await tx.copy.createMany({ data: data.copies.map(copy => ({ accession: copy.accession, titleId: title.id, copyNumber: copy.copyNo, shelfLocation: copy.location || null, callNumber: copy.callNo || null, status: copy.status })) });
      await tx.titleContributor.createMany({ data: [...data.contributors.map(c => ({ legacySourceTable: "v2", legacyId: null, titleId: title.id, authorId: c.writerId, role: c.role })), ...data.corporate.map(c => ({ legacySourceTable: "v2", legacyId: null, titleId: title.id, corporateId: c.corpId, role: c.role }))] });
      return title;
    });
    res.status(201).json({ data: book });
  } catch (error) { next(error); }
});

catalogRouter.post("/books/:id", requireAuth, allowStaff(), auditRequest("CATALOG_EDIT"), idempotent, async (req, res, next) => {
  try {
    const data = bookInput.parse(req.body);
    const result = await prisma.$transaction(async tx => {
      const id = String(req.params.id);
      const existing = await tx.bookTitle.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new Error("Book not found.");
      await tx.bookTitle.update({ where: { id }, data: { title: data.title, preferredTitle: data.preferredTitle || null, isbn: data.isbn || null, subjectCategory: data.subjectCategory || null, program: data.program || null, summary: data.summary || null, contents: data.contents || null, publisherId: data.publisherId || null, publicationYear: data.year ? Number(data.year) : null } });
      for (const copy of data.copies) {
        if (copy.id) await tx.copy.update({ where: { id: copy.id }, data: { accession: copy.accession, copyNumber: copy.copyNo, shelfLocation: copy.location || null, callNumber: copy.callNo || null, status: copy.status } });
        else await tx.copy.create({ data: { accession: copy.accession, titleId: id, copyNumber: copy.copyNo, shelfLocation: copy.location || null, callNumber: copy.callNo || null, status: copy.status } });
      }
      return { id };
    });
    res.json({ data: result });
  } catch (error) { next(error); }
});
