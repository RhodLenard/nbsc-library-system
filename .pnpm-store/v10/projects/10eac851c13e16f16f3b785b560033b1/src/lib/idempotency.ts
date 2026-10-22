import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "./prisma.js";

export const idempotent: RequestHandler = async (req, res, next) => {
  const key = req.header("idempotency-key");
  if (!key) return res.status(400).json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key is required." } });
  const principal = res.locals.principal?.id ?? "anonymous";
  const digest = crypto.createHash("sha256").update(JSON.stringify(req.body ?? {})).digest("hex");
  const unique = { principalId: principal, method: req.method, path: req.path, key };
  const hit = await prisma.idempotencyKey.findUnique({ where: { principalId_method_path_key: unique } });
  if (hit && hit.expiresAt > new Date()) {
    if (hit.requestHash !== digest) return res.status(409).json({ error: { code: "IDEMPOTENCY_CONFLICT", message: "Key was reused with different input." } });
    if (hit.statusCode === 0) return res.status(409).json({ error: { code: "IDEMPOTENCY_IN_PROGRESS", message: "A request with this key is already in progress." } });
    return res.status(hit.statusCode).json(hit.response);
  }
  try {
    await prisma.idempotencyKey.create({ data: { ...unique, requestHash: digest, response: { pending: true }, statusCode: 0, expiresAt: new Date(Date.now() + 86_400_000) } });
  } catch {
    const winner = await prisma.idempotencyKey.findUnique({ where: { principalId_method_path_key: unique } });
    if (!winner || winner.requestHash !== digest) return res.status(409).json({ error: { code: "IDEMPOTENCY_CONFLICT", message: "Key was reused with different input." } });
    return res.status(409).json({ error: { code: "IDEMPOTENCY_IN_PROGRESS", message: "A request with this key is already in progress." } });
  }
  res.on("finish", () => {
    if (res.statusCode >= 400) void prisma.idempotencyKey.deleteMany({ where: unique });
  });
  const original = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode < 300) void prisma.idempotencyKey.update({ where: { principalId_method_path_key: unique }, data: { response: body as object, statusCode: res.statusCode, expiresAt: new Date(Date.now() + 86_400_000) } });
    return original(body);
  }) as typeof res.json;
  next();
};
