import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/auth.js";
import { recordAudit } from "../lib/audit.js";

export const appDataRouter = Router();

const copyStatus: Record<string, string> = { AVAILABLE: "Available", ON_LOAN: "Borrowed", RESERVED: "Reserved", LOST: "Lost", DAMAGED: "Damaged", REPLACED: "Replaced", REPAIR: "Damaged" };
const reservationStatus: Record<string, string> = { PENDING: "Pending", READY: "Ready", RECEIVED: "Received", CANCELLED: "Cancelled", EXPIRED: "Cancelled" };
const date = (value: Date | null) => value ? value.toISOString().slice(0, 10) : null;
const role = (value: string) => value;
const memberType = (value: string | null) => value?.toLowerCase() === "faculty" ? "Faculty" : value?.toLowerCase() === "staff" ? "Staff" : "Student";

appDataRouter.get("/bootstrap", requireAuth, async (req, res, next) => {
  try {
    const principal = res.locals.principal as { id: string; kind: "member" | "staff" };
    if (principal.kind === "staff") await recordAudit({ actorId: principal.id, actorRole: (res.locals.principal as { role?: string }).role, action: "MEMBER_RECORD_VIEW", targetType: "MEMBER_COLLECTION", request: req });
    const memberScope = principal.kind === "member" ? { id: principal.id } : undefined;
    const messageScope = principal.kind === "staff" ? { OR: [{ senderId: "staff" }, { recipientId: "staff" }] } : { OR: [{ senderId: principal.id }, { recipientId: principal.id }] };
    const [titles, members, staff, loans, reservations, fines, authors, publishers, corporates, incidents, messages, visits, notifications, auditEvents, backups] = await Promise.all([
      prisma.bookTitle.findMany({ select: { id: true, title: true, preferredTitle: true, isbn: true, subjectCategory: true, program: true, summary: true, contents: true, coverImage: true, publisherId: true, publicationYear: true, createdAt: true, copies: { select: { id: true, legacyAccession: true, accession: true, copyNumber: true, shelfLocation: true, status: true, callNumber: true } }, contributors: { select: { authorId: true, corporateId: true, role: true } } }, orderBy: { title: "asc" } }),
      prisma.member.findMany({ where: memberScope, select: { id: true, schoolId: true, name: true, email: true, program: true, memberType: true, status: true, createdAt: true, phone: true }, orderBy: { name: "asc" } }),
      principal.kind === "staff" ? prisma.staff.findMany({ select: { id: true, employeeId: true, name: true, email: true, role: true, status: true, updatedAt: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
      prisma.loan.findMany({ where: principal.kind === "member" ? { memberId: principal.id } : undefined, select: { id: true, copyId: true, memberId: true, issuedAt: true, dueAt: true, returnedAt: true }, orderBy: { issuedAt: "desc" } }),
      prisma.reservation.findMany({ where: principal.kind === "member" ? { memberId: principal.id } : undefined, select: { id: true, memberId: true, titleId: true, copyId: true, status: true, reservedAt: true, readyAt: true }, orderBy: { reservedAt: "desc" } }),
      prisma.fine.findMany({ where: principal.kind === "member" ? { loan: { memberId: principal.id } } : undefined, select: { id: true, loanId: true, amount: true, status: true, assessedAt: true, paidAt: true, paymentMethod: true, loan: { select: { memberId: true, issuedAt: true, dueAt: true } } }, orderBy: { assessedAt: "desc" } }),
      prisma.author.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
      prisma.publisher.findMany({ select: { id: true, name: true, place: true }, orderBy: { name: "asc" } }),
      prisma.corporateContributor.findMany({ select: { id: true, name: true, type: true }, orderBy: { name: "asc" } }),
      principal.kind === "staff" ? prisma.copyIncident.findMany({ select: { id: true, copyId: true, memberId: true, type: true, status: true, reportedAt: true }, orderBy: { reportedAt: "desc" } }) : Promise.resolve([]),
      prisma.message.findMany({ where: messageScope, select: { id: true, senderId: true, recipientId: true, subject: true, body: true, readAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      principal.kind === "staff" ? prisma.libraryVisit.findMany({ select: { id: true, memberId: true, enteredAt: true, exitedAt: true }, orderBy: { enteredAt: "desc" } }) : Promise.resolve([]),
      prisma.notification.findMany({ where: { recipientId: principal.kind === "staff" ? "staff" : principal.id }, select: { id: true, recipientId: true, kind: true, text: true, readAt: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      principal.kind === "staff" ? prisma.auditEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 100 }) : Promise.resolve([]),
      principal.kind === "staff" ? prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 }) : Promise.resolve([]),
    ]);

    res.json({ data: {
      books: titles.map(title => ({
        id: title.id, title: title.title, preferredTitle: title.preferredTitle ?? title.title, parallelTitle: "", subjectCategory: title.subjectCategory ?? "", program: title.program ?? "", subjectDetail: "", summary: title.summary ?? "", contents: title.contents ?? "", coverImage: title.coverImage ?? "", images: "", dimension: "", series: "", volume: "", part: "", edition: "", pages: "", supplementary: "", isbn: title.isbn ?? "", language: "", callBase: "", shelfLocation: "", contentType: "", mediaType: "", carrierType: "", publisherId: title.publisherId ?? "", place: "", year: title.publicationYear?.toString() ?? "", contributors: title.contributors.filter(link => link.authorId).map(link => ({ writerId: link.authorId!, role: link.role })), corporate: title.contributors.filter(link => link.corporateId).map(link => ({ corpId: link.corporateId!, role: link.role })), addedOn: title.createdAt.toISOString(),
      })),
      copies: titles.flatMap(title => title.copies.map(copy => ({ id: copy.id, bookId: title.id, accession: copy.legacyAccession ?? copy.accession, copyNo: copy.copyNumber ?? 0, edition: "", location: copy.shelfLocation ?? "", status: copyStatus[copy.status] ?? "Damaged", callNo: copy.callNumber ?? "" }))),
      writers: authors.map(author => ({ id: author.id, name: author.displayName, born: "", notes: "" })),
      publishers: publishers.map(publisher => ({ id: publisher.id, name: publisher.name, place: publisher.place ?? "" })),
      corporates: corporates.map(corporate => ({ id: corporate.id, name: corporate.name, kind: corporate.type ?? "" })),
      members: members.map(member => ({ id: member.id, idNo: member.schoolId ?? "", name: member.name, email: member.email ?? "", program: member.program ?? "", type: memberType(member.memberType), status: member.status === "ACTIVE" ? "Active" : "Inactive", joined: member.createdAt.toISOString().slice(0, 10), phone: member.phone ?? "" })),
      staff: staff.map(account => ({ id: account.id, employeeId: account.employeeId ?? "", name: account.name, email: account.email ?? "", role: role(account.role), status: account.status === "ACTIVE" ? "Active" : "Inactive", lastLogin: account.updatedAt.toISOString() })),
      loans: loans.map(loan => ({ id: loan.id, copyId: loan.copyId, memberId: loan.memberId, borrowed: date(loan.issuedAt)!, due: date(loan.dueAt)!, returned: date(loan.returnedAt) })),
      reservations: reservations.map(reservation => ({ id: reservation.id, memberId: reservation.memberId, bookId: reservation.titleId, copyId: reservation.copyId, status: reservationStatus[reservation.status] ?? "Cancelled", date: date(reservation.reservedAt)!, readyUntil: date(reservation.readyAt) })),
      fines: fines.map(fine => ({ id: fine.id, loanId: fine.loanId, memberId: fine.loan.memberId, amount: Number(fine.amount), days: Math.max(0, Math.ceil((fine.assessedAt.getTime() - fine.loan.dueAt.getTime()) / 86_400_000)), paid: fine.status === "PAID", paidOn: date(fine.paidAt), method: fine.paymentMethod })),
      incidents: incidents.map(incident => ({ id: incident.id, copyId: incident.copyId, memberId: incident.memberId, type: incident.type === "DAMAGED" ? "Damaged" : "Lost", status: incident.status === "REPLACED" ? "Replaced" : "Unreplaced", date: date(incident.reportedAt)! })),
      messages: messages.map(message => ({ id: message.id, fromId: message.senderId, toId: message.recipientId, subject: message.subject, body: message.body, date: message.createdAt.toISOString(), read: Boolean(message.readAt) })),
      visits: visits.map(visit => ({ id: visit.id, memberId: visit.memberId, inAt: visit.enteredAt.toISOString(), outAt: visit.exitedAt?.toISOString() ?? null })),
      notices: notifications.map(notification => ({ id: notification.id, toId: notification.recipientId, text: notification.text, kind: ["loan", "reservation", "fine", "system"].includes(notification.kind) ? notification.kind : "system", date: notification.createdAt.toISOString(), read: Boolean(notification.readAt) })),
      activity: auditEvents.map(event => ({ id: event.id, actor: event.actorId ?? "System", text: `${event.action}${event.targetType ? ` · ${event.targetType}${event.targetId ? `/${event.targetId}` : ""}` : ""}`, date: event.occurredAt.toISOString() })),
      backups: backups.map(backup => ({ id: backup.id, name: backup.filePath ?? backup.id, date: backup.startedAt.toISOString(), size: backup.sizeBytes ? `${backup.sizeBytes.toString()} bytes` : "—", status: backup.status === "VERIFIED" ? "Completed" : backup.status === "RUNNING" ? "Running" : "Failed", kind: backup.kind === "MANUAL" ? "Manual" : "Automatic" })),
    } });
  } catch (error) { next(error); }
});
