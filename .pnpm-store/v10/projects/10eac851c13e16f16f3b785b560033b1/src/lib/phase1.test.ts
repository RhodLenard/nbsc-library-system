import { describe, expect, it, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-tests";

const rolePermissionFindUnique = vi.fn();
const auditCreate = vi.fn();
const idempotencyFindUnique = vi.fn();
const idempotencyCreate = vi.fn();
const idempotencyUpdate = vi.fn();
const idempotencyDeleteMany = vi.fn();
vi.mock("./prisma.js", () => ({ prisma: {
  rolePermission: { findUnique: rolePermissionFindUnique },
  auditEvent: { create: auditCreate },
  idempotencyKey: { findUnique: idempotencyFindUnique, create: idempotencyCreate, update: idempotencyUpdate, deleteMany: idempotencyDeleteMany },
} }));

describe("Phase 1 role permission matrix", async () => {
  const { hasPermission, STAFF_ROLES } = await import("./roles.js");
  beforeEach(() => rolePermissionFindUnique.mockReset());
  it("gives all three staff roles the same staff permission", async () => {
    rolePermissionFindUnique.mockResolvedValue({ id: "x" });
    const results = await Promise.all(STAFF_ROLES.map(role => hasPermission(role, "STAFF_ALL")));
    expect(results).toEqual([true, true, true]);
    expect(rolePermissionFindUnique).toHaveBeenCalledTimes(3);
  });
  it("denies Member and unknown roles", async () => {
    rolePermissionFindUnique.mockResolvedValue(null);
    expect(await hasPermission("Member", "STAFF_ALL")).toBe(false);
    expect(await hasPermission("Encoder", "STAFF_ALL")).toBe(false);
    expect(rolePermissionFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe("audit service redaction", async () => {
  const { recordAudit } = await import("./audit.js");
  beforeEach(() => auditCreate.mockReset());
  it("never persists credentials or tokens", async () => {
    auditCreate.mockResolvedValue({ id: "a" });
    await recordAudit({ action: "TEST", afterData: { password: "secret", accessToken: "token", name: "ok" } });
    const data = auditCreate.mock.calls[0][0].data.afterData;
    expect(data).toEqual({ name: "ok" });
  });
});

describe("login rate limiting contract", async () => {
  const { loginRateLimitState } = await import("../routes/auth.js");
  it("uses five attempts in a fifteen minute window", () => {
    expect(loginRateLimitState.MAX_FAILURES).toBe(5);
    expect(loginRateLimitState.WINDOW_MS).toBe(15 * 60 * 1000);
  });
});

describe("staff account safety", async () => {
  const { assertLastAdminSafe, assertSelfAccountSafe } = await import("./account-safety.js");
  it("blocks self deactivation and self role changes", () => {
    expect(() => assertSelfAccountSafe("a", "a", "Inactive", "Admin", "Admin")).toThrow();
    expect(() => assertSelfAccountSafe("a", "a", "Active", "Librarian", "Admin")).toThrow();
  });
  it("blocks deactivating the last active Admin", () => {
    expect(() => assertLastAdminSafe(true, true, 0)).toThrow();
    expect(() => assertLastAdminSafe(true, true, 1)).not.toThrow();
  });
});

describe("circulation idempotency", async () => {
  const { idempotent } = await import("./idempotency.js");
  beforeEach(() => { idempotencyFindUnique.mockReset(); idempotencyCreate.mockReset(); idempotencyUpdate.mockReset(); idempotencyDeleteMany.mockReset(); });
  const response = () => {
    const listeners: Record<string, () => void> = {};
    const res = { statusCode: 200, body: undefined as unknown, locals: { principal: { id: "staff-1" } }, on: vi.fn((name: string, listener: () => void) => { listeners[name] = listener; }), status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
    return { res, finish: () => listeners.finish?.() };
  };
  const request = () => ({ header: (name: string) => name === "idempotency-key" ? "request-key" : undefined, method: "POST", path: "/loans", body: { copyIds: ["copy-1"] }, locals: { principal: { id: "staff-1" } } });
  it("claims a key before running the request and saves the successful response", async () => {
    idempotencyFindUnique.mockResolvedValue(null); idempotencyCreate.mockResolvedValue({}); idempotencyUpdate.mockResolvedValue({});
    const { res } = response(); const next = vi.fn();
    await idempotent(request() as never, res as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(idempotencyCreate).toHaveBeenCalledOnce();
    res.status(201).json({ data: { id: "loan-1" } });
    await Promise.resolve();
    expect(idempotencyUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ statusCode: 201 }) }));
  });
  it("rejects a simultaneous duplicate key instead of executing twice", async () => {
    idempotencyFindUnique.mockResolvedValue(null); idempotencyCreate.mockRejectedValue(new Error("unique"));
    const requestHash = crypto.createHash("sha256").update(JSON.stringify({ copyIds: ["copy-1"] })).digest("hex");
    idempotencyFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ requestHash, statusCode: 0 });
    const { res } = response(); const next = vi.fn();
    await idempotent(request() as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.objectContaining({ code: "IDEMPOTENCY_IN_PROGRESS" }) }));
  });
});
