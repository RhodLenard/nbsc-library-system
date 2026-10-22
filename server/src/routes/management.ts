import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { allowStaff, requireAuth } from "../lib/auth.js";
import { idempotent } from "../lib/idempotency.js";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { STAFF_ROLES, isStaffRole } from "../lib/roles.js";
import { restoreBackupToTestDatabase, runBackup } from "../lib/backup.js";
import { assertLastAdminSafe, assertSelfAccountSafe } from "../lib/account-safety.js";
import { auditRequest, recordAudit } from "../lib/audit.js";
import { readSpreadsheet, workbookDownload } from "../lib/spreadsheets.js";

export const managementRouter = Router();
const PROGRAMS = ["BSCS", "BSA", "BSAIS", "BSE", "BSTM"] as const;
const memberInput = z.object({ idNo: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(300), email: z.string().trim().email().max(190), program: z.enum(PROGRAMS), type: z.enum(["Student", "Faculty", "Staff"]), phone: z.string().trim().max(100).optional(), status: z.enum(["Active", "Inactive"]).default("Active") });
const statusInput = z.object({ ids: z.array(z.string()).min(1), status: z.enum(["Active", "Inactive"]) });
const incidentInput = z.object({ copyId: z.string(), memberId: z.string().nullable().optional(), type: z.enum(["Lost", "Damaged"]) });
const messageInput = z.object({ recipientId: z.string(), subject: z.string().trim().min(1).max(300), body: z.string().trim().min(1).max(10_000) });
const staffInput = z.object({ employeeId: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(300), email: z.string().trim().email().max(190), role: z.enum(STAFF_ROLES), status: z.enum(["Active", "Inactive"]).default("Active"), password: z.string().min(12).max(128).optional() });
const importUsersInput = z.object({ format: z.enum(["csv", "xlsx"]), contentBase64: z.string().min(1).max(40_000_000), defaultPassword: z.string().min(12).max(128) });
const replacementInput = z.object({ amount: z.number().positive().max(1_000_000), reason: z.string().trim().min(1).max(100).default("Replacement") });
const value = (row: Record<string, string>, ...names: string[]) => names.map(name => row[name]).find(item => item !== undefined)?.trim() ?? "";

managementRouter.get("/audit-events", requireAuth, allowStaff(), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50) || 50));
    const [total, items] = await prisma.$transaction([
      prisma.auditEvent.count(),
      prisma.auditEvent.findMany({ orderBy: { occurredAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    res.json({ data: { items, meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } } });
  } catch (error) { next(error); }
});

managementRouter.get("/backups", requireAuth, allowStaff(), async (_req, res, next) => {
  try { res.json({ data: await prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 }) }); } catch (error) { next(error); }
});

managementRouter.post("/backups", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const result = await runBackup("MANUAL");
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "BACKUP_REQUESTED", targetType: "BACKUP_RUN", targetId: result.id, request: req, afterData: { status: result.status } });
    res.status(result.status === "VERIFIED" ? 201 : 500).json({ data: result });
  } catch (error) { next(error); }
});

managementRouter.post("/backups/:id/restore-test", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const result = await restoreBackupToTestDatabase(String(req.params.id));
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "BACKUP_RESTORE_TEST_COMPLETED", targetType: "BACKUP_RUN", targetId: result.runId, request: req, afterData: { targetDatabase: result.targetDatabase } });
    res.json({ data: result });
  } catch (error) {
    const principal = res.locals.principal as { id: string; role: string };
    await recordAudit({ actorId: principal.id, actorRole: principal.role, action: "BACKUP_RESTORE_TEST_FAILED", targetType: "BACKUP_RUN", targetId: String(req.params.id), request: req, afterData: { failed: true } });
    next(error);
  }
});

managementRouter.post("/import/users", requireAuth, allowStaff(), auditRequest("MEMBER_IMPORT"), idempotent, async (req, res, next) => {
  try {
    const data = importUsersInput.parse(req.body);
    const rows = readSpreadsheet(data);
    if (!rows.length) throw new Error("The file must contain a header and at least one member row.");
    const rejected: { row: number; reason: string }[] = [], valid: { schoolId: string; name: string; email: string; program: string; memberType: string; phone: string | null; passwordHash: string }[] = [];
    const passwordHash = await bcrypt.hash(data.defaultPassword, 12);
    const seen = new Set<string>();
    rows.forEach((entry, offset) => {
      const row = offset + 2, schoolId = value(entry, "idno", "id", "student id", "employee id"), name = value(entry, "name", "full name"), email = value(entry, "email", "email address").toLowerCase();
      if (!schoolId || !name || !/^\S+@\S+\.\S+$/.test(email)) return rejected.push({ row, reason: "Missing ID/name or invalid email" });
      if (seen.has(schoolId) || seen.has(email)) return rejected.push({ row, reason: "Duplicate ID or email in file" });
      seen.add(schoolId); seen.add(email);
      const memberType = value(entry, "type", "user type"), program = value(entry, "program", "course");
      if (!(PROGRAMS as readonly string[]).includes(program)) return rejected.push({ row, reason: `Program must be one of: ${PROGRAMS.join(", ")}.` });
      valid.push({ schoolId, name, email, program, memberType: ["Student", "Faculty", "Staff"].includes(memberType) ? memberType : "Student", phone: value(entry, "phone", "mobile") || null, passwordHash });
    });
    const result = await prisma.$transaction(async tx => {
      const created: string[] = [];
      for (const member of valid) {
        const duplicate = await tx.member.findFirst({ where: { OR: [{ schoolId: member.schoolId }, { email: member.email }] }, select: { id: true } });
        if (duplicate) { rejected.push({ row: 0, reason: `Existing ID or email: ${member.schoolId}` }); continue; }
        const createdMember = await tx.member.create({ data: { ...member, status: "ACTIVE" }, select: { id: true } }); created.push(createdMember.id);
      }
      return created;
    });
    res.status(201).json({ data: { imported: result.length, rejected } });
  } catch (error) { next(error); }
});

managementRouter.get("/members/export", requireAuth, allowStaff(), async (req, res, next) => {
  try {
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";
    const program = String(req.query.program ?? "").trim(), type = String(req.query.type ?? "").trim(), status = String(req.query.status ?? "").trim().toUpperCase();
    const members = await prisma.member.findMany({ where: { ...(program ? { program } : {}), ...(type ? { memberType: type } : {}), ...(status === "ACTIVE" || status === "INACTIVE" ? { status: status as "ACTIVE" | "INACTIVE" } : {}) }, orderBy: { name: "asc" }, include: { _count: { select: { loans: true, reservations: true } } } });
    const content = workbookDownload(members.map(member => ({ "ID no.": member.schoolId ?? "", Name: member.name, Email: member.email ?? "", Program: member.program ?? "", Type: member.memberType ?? "", Phone: member.phone ?? "", Status: member.status, Loans: member._count.loans, Reservations: member._count.reservations, "Created at": member.createdAt.toISOString() })), format, "Members");
    res.type(format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv"); res.attachment(`members-export.${format}`); res.send(content);
  } catch (error) { next(error); }
});

managementRouter.get("/reports/export", requireAuth, allowStaff(), auditRequest("REPORT_EXPORT"), async (req, res, next) => {
  try {
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";
    const kind = String(req.query.kind ?? "circulation");
    const program = String(req.query.program ?? "").trim(), category = String(req.query.category ?? "").trim(), range = String(req.query.range ?? "30");
    const days = range === "7" || range === "30" || range === "90" ? Number(range) : null;
    const cutoff = days ? new Date(Date.now() - days * 86_400_000) : null;
    const inRange = (date: Date) => !cutoff || date >= cutoff;
    let rows: Record<string, unknown>[];
    if (kind === "collection") {
      rows = (await prisma.copy.findMany({ where: { title: { ...(program ? { program } : {}), ...(category ? { subjectCategory: category } : {}) } }, include: { title: true }, orderBy: { accession: "asc" } })).map(copy => ({ Title: copy.title.title, Category: copy.title.subjectCategory ?? "", Program: copy.title.program ?? "", Accession: copy.accession, "Copy number": copy.copyNumber ?? "", Status: copy.status, Location: copy.shelfLocation ?? "", Year: copy.title.publicationYear ?? "" }));
    } else if (kind === "fines") {
      rows = (await prisma.fine.findMany({ include: { loan: { include: { member: true, copy: { include: { title: true } } } } }, orderBy: { assessedAt: "desc" } })).filter(fine => inRange(fine.loan.dueAt) && (!program || fine.loan.member.program === program) && (!category || fine.loan.copy.title.subjectCategory === category)).map(fine => ({ Assessed: fine.assessedAt.toISOString(), Member: fine.loan.member.name, Title: fine.loan.copy.title.title, Amount: fine.amount.toString(), Status: fine.status, Reason: fine.reason ?? "" }));
    } else if (kind === "members") {
      rows = (await prisma.member.findMany({ where: { ...(program ? { program } : {}) }, include: { _count: { select: { loans: true } } }, orderBy: { name: "asc" } })).filter(member => inRange(member.createdAt)).map(member => ({ "ID no.": member.schoolId ?? "", Name: member.name, Program: member.program ?? "", Type: member.memberType ?? "", Status: member.status, Loans: member._count.loans, Joined: member.createdAt.toISOString() }));
    } else if (kind === "visits") {
      const visits = (await prisma.libraryVisit.findMany({ orderBy: { enteredAt: "desc" } })).filter(visit => inRange(visit.enteredAt));
      const members = new Map((await prisma.member.findMany({ select: { id: true, name: true, program: true } })).map(member => [member.id, member]));
      rows = visits.filter(visit => !program || members.get(visit.memberId)?.program === program).map(visit => ({ Member: members.get(visit.memberId)?.name ?? visit.memberId, Program: members.get(visit.memberId)?.program ?? "", "Time in": visit.enteredAt.toISOString(), "Time out": visit.exitedAt?.toISOString() ?? "Inside" }));
    } else {
      rows = (await prisma.loan.findMany({ include: { member: true, copy: { include: { title: true } } }, orderBy: { issuedAt: "desc" } })).filter(loan => inRange(loan.issuedAt) && (!program || loan.member.program === program) && (!category || loan.copy.title.subjectCategory === category)).map(loan => ({ Borrowed: loan.issuedAt.toISOString(), Member: loan.member.name, Title: loan.copy.title.title, Category: loan.copy.title.subjectCategory ?? "", Due: loan.dueAt.toISOString(), Status: loan.status === "RETURNED" ? "Returned" : loan.status === "LOST" ? "Lost" : "On loan" }));
    }
    const content = workbookDownload(rows, format, `${kind} report`);
    res.type(format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv");
    res.attachment(`${kind}-report.${format}`);
    res.send(content);
  } catch (error) { next(error); }
});

managementRouter.post("/accounts", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const data = staffInput.extend({ password: z.string().min(12).max(128) }).parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const account = await prisma.staff.create({ data: { employeeId: data.employeeId, name: data.name, email: data.email.toLowerCase(), role: data.role, status: data.status === "Active" ? "ACTIVE" : "INACTIVE", passwordHash }, select: { id: true } });
    res.status(201).json({ data: { id: account.id } });
  } catch (error) { next(error); }
});

managementRouter.post("/accounts/:id", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const data = staffInput.parse(req.body);
    const principal = res.locals.principal as { id: string; role: string };
    assertSelfAccountSafe(principal.id, String(req.params.id), data.status, data.role, principal.role);
    if (data.role !== principal.role && !(await prisma.staff.findUnique({ where: { id: String(req.params.id) }, select: { role: true } }))) throw new Error("Staff account was not found.");
    if (data.status === "Inactive" || data.role !== "Admin") {
      const target = await prisma.staff.findUnique({ where: { id: String(req.params.id) }, select: { role: true, status: true } });
      if (target?.role === "Admin" && target.status === "ACTIVE" && (data.status === "Inactive" || data.role !== "Admin")) {
        const activeAdmins = await prisma.staff.count({ where: { role: "Admin", status: "ACTIVE", id: { not: String(req.params.id) } } });
        assertLastAdminSafe(true, true, activeAdmins);
      }
    }
    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : undefined;
    await prisma.staff.update({ where: { id: String(req.params.id) }, data: { employeeId: data.employeeId, name: data.name, email: data.email.toLowerCase(), role: data.role, status: data.status === "Active" ? "ACTIVE" : "INACTIVE", ...(passwordHash ? { passwordHash } : {}) } });
    res.json({ data: { id: String(req.params.id) } });
  } catch (error) { next(error); }
});

managementRouter.post("/members", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const data = memberInput.parse(req.body);
    const member = await prisma.member.create({ data: { schoolId: data.idNo, name: data.name, email: data.email, program: data.program, memberType: data.type, phone: data.phone || null, status: data.status === "Active" ? "ACTIVE" : "INACTIVE" } });
    res.status(201).json({ data: { id: member.id } });
  } catch (error) { next(error); }
});
managementRouter.post("/members/:id", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const data = memberInput.parse(req.body);
    await prisma.member.update({ where: { id: String(req.params.id) }, data: { schoolId: data.idNo, name: data.name, email: data.email, program: data.program, memberType: data.type, phone: data.phone || null, status: data.status === "Active" ? "ACTIVE" : "INACTIVE" } });
    res.json({ data: { id: String(req.params.id) } });
  } catch (error) { next(error); }
});
managementRouter.post("/members/:id/password/reset", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const member = await prisma.member.findUnique({ where: { id }, select: { id: true } });
    if (!member) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Member was not found." } });
    const password = `${crypto.randomBytes(9).toString("base64url")}Aa1!`;
    await prisma.member.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "MEMBER_PASSWORD_RESET", targetType: "MEMBER", targetId: id, request: req, afterData: { generated: true } });
    res.json({ data: { password } });
  } catch (error) { next(error); }
});
managementRouter.post("/members/status", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const data = statusInput.parse(req.body);
    await prisma.member.updateMany({ where: { id: { in: data.ids } }, data: { status: data.status === "Active" ? "ACTIVE" : "INACTIVE" } });
    res.json({ data: { ids: data.ids } });
  } catch (error) { next(error); }
});

managementRouter.post("/incidents", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const data = incidentInput.parse(req.body);
    const incident = await prisma.$transaction(async tx => {
      const copy = await tx.copy.findUnique({ where: { id: data.copyId } });
      if (!copy || ["LOST", "DAMAGED", "REPLACED"].includes(copy.status)) throw new Error("Copy is unavailable for an incident report.");
      const loan = await tx.loan.findFirst({ where: { copyId: copy.id, status: "ACTIVE" } });
      if (loan) await tx.loan.update({ where: { id: loan.id }, data: { status: "LOST", returnedAt: new Date() } });
      await tx.copy.update({ where: { id: copy.id }, data: { status: data.type === "Lost" ? "LOST" : "DAMAGED" } });
      return tx.copyIncident.create({ data: { copyId: copy.id, memberId: data.memberId || loan?.memberId || null, type: data.type.toUpperCase() } });
    });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "COPY_INCIDENT_REPORTED", targetType: "COPY_INCIDENT", targetId: incident.id, request: req, afterData: { copyId: incident.copyId, memberId: incident.memberId, type: incident.type } });
    res.status(201).json({ data: incident });
  } catch (error) { next(error); }
});
managementRouter.post("/incidents/:id/replace", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const charge = replacementInput.parse(req.body);
    const result = await prisma.$transaction(async tx => {
      const incident = await tx.copyIncident.findUnique({ where: { id: String(req.params.id) } });
      if (!incident || incident.status !== "UNREPLACED") throw new Error("Incident is already resolved.");
      if (!incident.memberId) throw new Error("A responsible member is required before recording a replacement fine.");
      const loan = await tx.loan.findFirst({ where: { copyId: incident.copyId, memberId: incident.memberId }, orderBy: { issuedAt: "desc" } });
      if (!loan) throw new Error("No loan was found for the responsible member and copy.");
      await tx.fine.create({ data: { loanId: loan.id, amount: charge.amount, reason: charge.reason, status: "UNPAID", assessedAt: new Date() } });
      await tx.copy.update({ where: { id: incident.copyId }, data: { status: "REPLACED" } });
      return tx.copyIncident.update({ where: { id: incident.id }, data: { status: "REPLACED", resolvedAt: new Date() } });
    });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "COPY_INCIDENT_REPLACED", targetType: "COPY_INCIDENT", targetId: result.id, request: req, afterData: { copyId: result.copyId } });
    res.json({ data: result });
  } catch (error) { next(error); }
});
managementRouter.post("/copies/:id/restore", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const before = await prisma.copy.findUnique({ where: { id: String(req.params.id) }, select: { status: true } });
    await prisma.copy.update({ where: { id: String(req.params.id) }, data: { status: "AVAILABLE" } });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "COPY_RESTORED", targetType: "COPY", targetId: String(req.params.id), request: req, beforeData: before, afterData: { status: "AVAILABLE" } });
    res.json({ data: { id: String(req.params.id) } });
  } catch (error) { next(error); }
});

managementRouter.post("/messages", requireAuth, idempotent, async (req, res, next) => {
  try {
    const data = messageInput.parse(req.body);
    const principal = res.locals.principal as { id: string; kind: string };
    const recipientId = principal.kind === "member" ? "staff" : data.recipientId;
    if (principal.kind === "staff" && !(await prisma.member.findUnique({ where: { id: recipientId }, select: { id: true } }))) throw new Error("Message recipient was not found.");
    const message = await prisma.message.create({ data: { senderId: principal.kind === "staff" ? "staff" : principal.id, recipientId, subject: data.subject, body: data.body } });
    res.status(201).json({ data: message });
  } catch (error) { next(error); }
});
managementRouter.post("/messages/:id/read", requireAuth, idempotent, async (req, res, next) => {
  try {
    const principal = res.locals.principal as { id: string; kind: string };
    const recipientId = principal.kind === "staff" ? "staff" : principal.id;
    const result = await prisma.message.updateMany({ where: { id: String(req.params.id), recipientId, readAt: null }, data: { readAt: new Date() } });
    res.json({ data: { count: result.count } });
  } catch (error) { next(error); }
});
managementRouter.post("/notifications/:id/read", requireAuth, idempotent, async (req, res, next) => {
  try {
    const principal = res.locals.principal as { id: string; kind: string };
    const recipientId = principal.kind === "staff" ? "staff" : principal.id;
    await prisma.notification.updateMany({ where: { id: String(req.params.id), recipientId, readAt: null }, data: { readAt: new Date() } });
    res.json({ data: { id: String(req.params.id) } });
  } catch (error) { next(error); }
});
managementRouter.post("/notifications/read-all", requireAuth, idempotent, async (_req, res, next) => {
  try {
    const principal = res.locals.principal as { id: string; kind: string };
    const recipientId = principal.kind === "staff" ? "staff" : principal.id;
    await prisma.notification.updateMany({ where: { recipientId, readAt: null }, data: { readAt: new Date() } });
    res.json({ data: { ok: true } });
  } catch (error) { next(error); }
});

managementRouter.post("/visits", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const memberId = z.object({ memberId: z.string() }).parse(req.body).memberId;
    const visit = await prisma.$transaction(async tx => {
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member || member.status !== "ACTIVE") throw new Error("Member is unavailable.");
      if (await tx.libraryVisit.findFirst({ where: { memberId, exitedAt: null } })) throw new Error("Member is already inside.");
      return tx.libraryVisit.create({ data: { memberId } });
    });
    res.status(201).json({ data: visit });
  } catch (error) { next(error); }
});
managementRouter.post("/visits/:id/exit", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const result = await prisma.libraryVisit.updateMany({ where: { id: String(req.params.id), exitedAt: null }, data: { exitedAt: new Date() } });
    if (!result.count) throw new Error("Visit is no longer active.");
    res.json({ data: { id: String(req.params.id) } });
  } catch (error) { next(error); }
});
