import type { RequestHandler } from "express";
import { prisma } from "./prisma.js";

export const STAFF_ROLES = ["Admin", "Librarian", "Student Assistant"] as const;
export const ROLES = [...STAFF_ROLES, "Member"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_PERMISSION = "STAFF_ALL";

export const isKnownRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);
export const isStaffRole = (value: string): value is (typeof STAFF_ROLES)[number] => (STAFF_ROLES as readonly string[]).includes(value);

export async function hasPermission(role: string, permission: string): Promise<boolean> {
  if (!isKnownRole(role)) return false;
  const row = await prisma.rolePermission.findUnique({ where: { role_permission: { role, permission } } });
  return Boolean(row);
}

export const requirePermission = (permission: string): RequestHandler => async (_req, res, next) => {
  const principal = res.locals.principal as { role?: string } | undefined;
  if (!principal?.role || !(await hasPermission(principal.role, permission))) return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission for this action." } });
  next();
};

export const allowStaff = (..._roles: string[]): RequestHandler => requirePermission(STAFF_PERMISSION);
