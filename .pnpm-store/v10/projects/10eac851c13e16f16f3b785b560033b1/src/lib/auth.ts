import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import { isKnownRole, isStaffRole, requirePermission, STAFF_PERMISSION } from "./roles.js";

export type Principal = { id: string; kind: "member" | "staff"; role: string };
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET must be configured.");

export const signSession = (principal: Principal) => jwt.sign(principal, secret, { expiresIn: "15m" });

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Authentication is required." } });
  try {
    res.locals.principal = jwt.verify(token, secret) as Principal;
    next();
  } catch {
    res.status(401).json({ error: { code: "INVALID_SESSION", message: "Your session has expired. Please sign in again." } });
  }
};

export const allowStaff = (..._roles: string[]): RequestHandler => (req, res, next) => {
  const principal = res.locals.principal as Principal | undefined;
  if (principal?.kind !== "staff" || !isStaffRole(principal.role)) return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission for this action." } });
  return requirePermission(STAFF_PERMISSION)(req, res, next);
};

export { isKnownRole };
