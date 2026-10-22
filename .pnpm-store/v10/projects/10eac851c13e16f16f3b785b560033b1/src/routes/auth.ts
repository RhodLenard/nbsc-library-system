import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, signSession } from "../lib/auth.js";
import { isKnownRole } from "../lib/roles.js";
import { recordAudit } from "../lib/audit.js";

const input = z.object({ accountType: z.enum(["member", "staff"]), identifier: z.string().min(1), password: z.string().min(1) });
const passwordInput = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });
const profileInput = z.object({ name: z.string().trim().min(1).max(300), email: z.string().trim().email().max(190), phone: z.string().trim().max(100).optional(), program: z.string().trim().max(225).optional() });
export const authRouter = Router();
const failures = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

export const loginRateLimitState = { failures, MAX_FAILURES, WINDOW_MS };

authRouter.post("/login", async (req, res, next) => {
  try {
    const data = input.parse(req.body);
    const key = `${req.ip}:${data.accountType}:${data.identifier.toLowerCase()}`;
    const now = Date.now();
    const current = failures.get(key);
    if (current && current.resetAt > now && current.count >= MAX_FAILURES) {
      await recordAudit({ action: "LOGIN_RATE_LIMITED", targetType: "AUTH", targetId: data.identifier, request: req, afterData: { accountType: data.accountType } });
      return res.status(429).json({ error: { code: "LOGIN_RATE_LIMITED", message: "Too many failed login attempts. Try again later." } });
    }
    const where = data.accountType === "member" ? { OR: [{ email: data.identifier }, { schoolId: data.identifier }] } : { OR: [{ email: data.identifier }, { employeeId: data.identifier }] };
    const account = data.accountType === "member" ? await prisma.member.findFirst({ where }) : await prisma.staff.findFirst({ where });
    if (!account?.passwordHash || !(await bcrypt.compare(data.password, account.passwordHash))) {
      const next = current && current.resetAt > now ? { count: current.count + 1, resetAt: current.resetAt } : { count: 1, resetAt: now + WINDOW_MS };
      failures.set(key, next);
      await recordAudit({ action: "LOGIN_FAILURE", targetType: "AUTH", targetId: data.identifier, request: req, afterData: { accountType: data.accountType, reason: "invalid_credentials", attemptCount: next.count } });
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid account or password." } });
    }
    if (account.status !== "ACTIVE") return res.status(403).json({ error: { code: "ACCOUNT_INACTIVE", message: "This account is inactive." } });
    const role = data.accountType === "member" ? "Member" : (account as { role: string }).role;
    if (!isKnownRole(role)) return res.status(500).json({ error: { code: "UNKNOWN_ROLE", message: "This account has an unsupported role." } });
    failures.delete(key);
    const principal = { id: account.id, kind: data.accountType, role } as const;
    await recordAudit({ actorId: account.id, actorRole: role, action: "LOGIN_SUCCESS", targetType: data.accountType, targetId: account.id, request: req });
    res.json({ data: { accessToken: signSession(principal), principal: { ...principal, name: account.name, email: account.email } } });
  } catch (error) { next(error); }
});

authRouter.get("/me", requireAuth, async (_req, res, next) => {
  try {
    const p = res.locals.principal;
    const account = p.kind === "member" ? await prisma.member.findUnique({ where: { id: p.id } }) : await prisma.staff.findUnique({ where: { id: p.id } });
    if (!account) return res.status(401).json({ error: { code: "INVALID_SESSION", message: "Account no longer exists." } });
    res.json({ data: { id: account.id, kind: p.kind, role: p.kind === "member" ? "Member" : (account as { role: string }).role, name: account.name, email: account.email } });
  } catch (error) { next(error); }
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const data = passwordInput.parse(req.body);
    const principal = res.locals.principal;
    const account = principal.kind === "member" ? await prisma.member.findUnique({ where: { id: principal.id } }) : await prisma.staff.findUnique({ where: { id: principal.id } });
    if (!account?.passwordHash || !(await bcrypt.compare(data.currentPassword, account.passwordHash))) return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect." } });
    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    if (principal.kind === "member") await prisma.member.update({ where: { id: principal.id }, data: { passwordHash } });
    else await prisma.staff.update({ where: { id: principal.id }, data: { passwordHash } });
    res.json({ data: { ok: true } });
  } catch (error) { next(error); }
});

authRouter.post("/profile", requireAuth, async (req, res, next) => {
  try {
    const data = profileInput.parse(req.body);
    const principal = res.locals.principal;
    if (principal.kind === "member") {
      await prisma.member.update({ where: { id: principal.id }, data: { name: data.name, email: data.email, phone: data.phone || null, program: data.program || null } });
    } else {
      await prisma.staff.update({ where: { id: principal.id }, data: { name: data.name, email: data.email } });
    }
    res.json({ data: { id: principal.id } });
  } catch (error) { next(error); }
});
