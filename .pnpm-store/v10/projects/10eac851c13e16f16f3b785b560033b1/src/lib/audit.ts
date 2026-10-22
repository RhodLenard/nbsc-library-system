import crypto from "node:crypto";
import type { Request } from "express";
import { prisma } from "./prisma.js";

type AuditInput = {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  request?: Request;
};

const redact = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object") return value;
  const blocked = new Set(["password", "passwordHash", "currentPassword", "newPassword", "token", "accessToken", "authorization"]);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !blocked.has(key)).map(([key, item]) => [key, redact(item)]));
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({ data: {
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      requestId: input.request?.header("x-request-id") ?? crypto.randomUUID(),
      ipAddress: input.request?.ip ?? null,
      beforeData: redact(input.beforeData) as object ?? undefined,
      afterData: redact(input.afterData) as object ?? undefined,
    } });
  } catch (error) {
    console.error("Audit event could not be persisted", error);
  }
}

export const auditRequest = (action: string) => async (req: Request, res: { locals: Record<string, unknown> }, next: () => void) => {
  const principal = res.locals.principal as { id?: string; kind?: string; role?: string } | undefined;
  if (principal?.kind === "staff") await recordAudit({ actorId: principal.id, actorRole: principal.role, action, request: req, afterData: { method: req.method, path: req.path } });
  next();
};
