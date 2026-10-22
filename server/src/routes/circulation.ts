import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { allowStaff, requireAuth } from "../lib/auth.js";
import { idempotent } from "../lib/idempotency.js";
import { recordAudit } from "../lib/audit.js";

export const circulationRouter = Router();
const issueInput = z.object({ memberId: z.string(), copyIds: z.array(z.string()).min(1).max(3), dueAt: z.coerce.date() });
const paymentInput = z.object({ fineIds: z.array(z.string()).min(1), method: z.string().trim().min(1).max(50) });
const reserveInput = z.object({ titleIds: z.array(z.string()).min(1).max(3) });
const readyInput = z.object({ copyId: z.string() });

circulationRouter.post("/loans", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const data = issueInput.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: data.memberId } });
      if (!member || member.status !== "ACTIVE") throw new Error("Member is unavailable.");
      const unpaid = await tx.fine.count({ where: { loan: { memberId: member.id }, status: "UNPAID" } });
      if (unpaid) throw new Error("Member has unpaid fines.");
      const copies = await tx.copy.findMany({ where: { id: { in: data.copyIds } } });
      if (copies.length !== data.copyIds.length || copies.some(copy => copy.status !== "AVAILABLE")) throw new Error("One or more copies are unavailable.");
      const claimed = await tx.copy.updateMany({ where: { id: { in: data.copyIds }, status: "AVAILABLE" }, data: { status: "ON_LOAN" } });
      if (claimed.count !== data.copyIds.length) throw new Error("One or more copies were claimed by another circulation request.");
      const loans = await Promise.all(copies.map(copy => tx.loan.create({ data: { memberId: member.id, copyId: copy.id, issuedAt: new Date(), dueAt: data.dueAt } })));
      await tx.notification.create({ data: { recipientId: member.id, kind: "loan", text: `You borrowed ${loans.length} item(s). Due ${data.dueAt.toISOString().slice(0, 10)}.` } });
      return loans;
    }, { isolationLevel: "Serializable" });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "LOAN_ISSUED", targetType: "LOAN", targetId: result.map(loan => loan.id).join(","), request: req, afterData: { memberId: data.memberId, copyIds: data.copyIds, dueAt: data.dueAt.toISOString() } });
    res.status(201).json({ data: result });
  } catch (error) { next(error); }
});

circulationRouter.post("/loans/:id/return", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: String(req.params.id) } });
      if (!loan || loan.status !== "ACTIVE") throw new Error("Loan is not active.");
      const returnedAt = new Date();
      const claimed = await tx.loan.updateMany({ where: { id: loan.id, status: "ACTIVE" }, data: { status: "RETURNED", returnedAt } });
      if (claimed.count !== 1) throw new Error("Loan is not active.");
      await tx.copy.update({ where: { id: loan.copyId }, data: { status: "AVAILABLE" } });
      if (returnedAt > loan.dueAt) {
        const fine = await tx.fine.create({ data: { loanId: loan.id, amount: Math.ceil((returnedAt.getTime() - loan.dueAt.getTime()) / 86_400_000) * 5, reason: "Overdue", assessedAt: returnedAt } });
        await tx.notification.create({ data: { recipientId: loan.memberId, kind: "fine", text: `A late-return fine of ₱${fine.amount.toString()} was added to your account.` } });
      }
      return { ...loan, status: "RETURNED" as const, returnedAt };
    }, { isolationLevel: "Serializable" });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "LOAN_RETURNED", targetType: "LOAN", targetId: result.id, request: req, afterData: { copyId: result.copyId, returnedAt: result.returnedAt.toISOString() } });
    res.json({ data: result });
  } catch (error) { next(error); }
});

circulationRouter.post("/fines/payments", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const data = paymentInput.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const fines = await tx.fine.findMany({ where: { id: { in: data.fineIds } } });
      if (fines.length !== data.fineIds.length || fines.some(fine => fine.status !== "UNPAID")) throw new Error("One or more fines are no longer unpaid.");
      const paidAt = new Date();
      await tx.fine.updateMany({ where: { id: { in: data.fineIds }, status: "UNPAID" }, data: { status: "PAID", paidAt, paymentMethod: data.method } });
      return { fineIds: data.fineIds, paidAt };
    }, { isolationLevel: "Serializable" });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "FINE_PAYMENT_RECORDED", targetType: "FINE", targetId: data.fineIds.join(","), request: req, afterData: { method: data.method, paidAt: result.paidAt.toISOString() } });
    res.json({ data: result });
  } catch (error) { next(error); }
});

circulationRouter.post("/reservations", requireAuth, idempotent, async (req, res, next) => {
  try {
    const principal = res.locals.principal as { id: string; kind: string };
    if (principal.kind !== "member") return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only members can place reservations." } });
    const { titleIds } = reserveInput.parse(req.body);
    const result = await prisma.$transaction(async tx => {
      const active = await tx.reservation.count({ where: { memberId: principal.id, status: { in: ["PENDING", "READY"] } } });
      if (active + titleIds.length > 3) throw new Error("Reservation limit reached.");
      const titles = await tx.bookTitle.findMany({ where: { id: { in: titleIds } }, select: { id: true, copies: { where: { status: "AVAILABLE" }, select: { id: true } } } });
      if (titles.length !== titleIds.length || titles.some(title => !title.copies.length)) throw new Error("One or more requested titles are unavailable.");
      const duplicate = await tx.reservation.count({ where: { memberId: principal.id, titleId: { in: titleIds }, status: { in: ["PENDING", "READY"] } } });
      if (duplicate) throw new Error("A requested title is already reserved.");
      return Promise.all(titleIds.map(titleId => tx.reservation.create({ data: { memberId: principal.id, titleId, reservedAt: new Date() } })));
    }, { isolationLevel: "Serializable" });
    res.status(201).json({ data: result });
  } catch (error) { next(error); }
});

circulationRouter.post("/reservations/:id/cancel", requireAuth, idempotent, async (req, res, next) => {
  try {
    const principal = res.locals.principal as { id: string; kind: string };
    const result = await prisma.$transaction(async tx => {
      const reservation = await tx.reservation.findUnique({ where: { id: String(req.params.id) } });
      if (!reservation || !["PENDING", "READY"].includes(reservation.status)) throw new Error("Reservation is not active.");
      if (principal.kind === "member" && reservation.memberId !== principal.id) throw new Error("Reservation does not belong to this member.");
      if (reservation.copyId) await tx.copy.update({ where: { id: reservation.copyId }, data: { status: "AVAILABLE" } });
      return tx.reservation.update({ where: { id: reservation.id }, data: { status: "CANCELLED", cancelledAt: new Date(), copyId: null } });
    });
    res.json({ data: result });
  } catch (error) { next(error); }
});

circulationRouter.post("/reservations/:id/ready", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const { copyId } = readyInput.parse(req.body);
    const result = await prisma.$transaction(async tx => {
      const reservation = await tx.reservation.findUnique({ where: { id: String(req.params.id) } });
      const copy = await tx.copy.findUnique({ where: { id: copyId } });
      if (!reservation || reservation.status !== "PENDING" || !copy || copy.status !== "AVAILABLE" || copy.titleId !== reservation.titleId) throw new Error("Reservation or copy is unavailable.");
      const claimed = await tx.copy.updateMany({ where: { id: copy.id, status: "AVAILABLE" }, data: { status: "RESERVED" } });
      if (claimed.count !== 1) throw new Error("Reservation copy was claimed by another circulation request.");
      const readyAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const updated = await tx.reservation.update({ where: { id: reservation.id }, data: { status: "READY", copyId, readyAt } });
      await tx.notification.create({ data: { recipientId: reservation.memberId, kind: "reservation", text: `Your reservation is ready for pickup until ${readyAt.toISOString().slice(0, 10)}.` } });
      return updated;
    });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "RESERVATION_READY", targetType: "RESERVATION", targetId: result.id, request: req, afterData: { copyId: result.copyId, readyAt: result.readyAt?.toISOString() } });
    res.json({ data: result });
  } catch (error) { next(error); }
});

circulationRouter.post("/reservations/:id/receive", requireAuth, allowStaff(), idempotent, async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async tx => {
      const reservation = await tx.reservation.findUnique({ where: { id: String(req.params.id) } });
      if (!reservation?.copyId || reservation.status !== "READY") throw new Error("Reservation is not ready for pickup.");
      const dueAt = new Date(Date.now() + 7 * 86_400_000);
      const claimed = await tx.reservation.updateMany({ where: { id: reservation.id, status: "READY", copyId: reservation.copyId }, data: { status: "RECEIVED", receivedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("Reservation is no longer ready for pickup.");
      await tx.copy.update({ where: { id: reservation.copyId }, data: { status: "ON_LOAN" } });
      const loan = await tx.loan.create({ data: { memberId: reservation.memberId, copyId: reservation.copyId, issuedAt: new Date(), dueAt } });
      return loan;
    }, { isolationLevel: "Serializable" });
    await recordAudit({ actorId: res.locals.principal.id, actorRole: res.locals.principal.role, action: "RESERVATION_RECEIVED", targetType: "RESERVATION", targetId: String(req.params.id), request: req, afterData: { loanId: result.id, copyId: result.copyId } });
    res.status(201).json({ data: result });
  } catch (error) { next(error); }
});
