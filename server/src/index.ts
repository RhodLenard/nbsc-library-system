import "dotenv/config";
import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { circulationRouter } from "./routes/circulation.js";
import { appDataRouter } from "./routes/app-data.js";
import { managementRouter } from "./routes/management.js";
import { requireAuth } from "./lib/auth.js";
import { auditRequest } from "./lib/audit.js";
import { runBackup } from "./lib/backup.js";

const requiredInProduction = ["DATABASE_URL", "JWT_SECRET", "CORS_ORIGIN"] as const;
if (process.env.NODE_ENV === "production") {
  for (const name of requiredInProduction) {
    const value = process.env[name]?.trim();
    if (!value || /change-this|change-the|replace-with|generate-a-long|localhost/i.test(value)) {
      throw new Error(`${name} must be configured with a production value.`);
    }
  }
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) throw new Error("JWT_SECRET must be at least 32 characters in production.");
  if ((process.env.CORS_ORIGIN ?? "").split(",").some(origin => !origin.trim().startsWith("https://"))) {
    throw new Error("CORS_ORIGIN must contain HTTPS origins in production.");
  }
}

const app = express();
const configuredOrigins = new Set((process.env.CORS_ORIGIN ?? "").split(",").map(value => value.trim()).filter(Boolean));
// Production only accepts the explicitly configured application origin(s).
if (process.env.NODE_ENV !== "production") {
  configuredOrigins.add("http://localhost:5173");
}
app.use(cors({ origin(origin, callback) {
  if (!origin || configuredOrigins.has(origin)) return callback(null, true);
  callback(new Error("Origin is not allowed by CORS policy."));
} }));
app.use(express.json({ limit: "1mb" }));
app.get("/v1/health", (_req, res) => res.json({ data: { status: "ok" } }));
app.use("/v1/auth", authRouter);
app.use("/v1/catalog", catalogRouter);
app.use("/v1/app", appDataRouter);
app.use("/v1/staff", requireAuth, auditRequest("STAFF_ACTION"));
app.use("/v1/staff", circulationRouter);
app.use("/v1/staff", managementRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(422).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: error.flatten() } });
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = /unavailable|unpaid|not active/i.test(message) ? 409 : 500;
  res.status(status).json({ error: { code: status === 409 ? "CONFLICT" : "INTERNAL_ERROR", message } });
});
const scheduleDailyBackup = () => {
  const now = new Date();
  const next = new Date(now); next.setHours(2, 0, 0, 0); if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => { void runBackup("AUTOMATIC"); setInterval(() => void runBackup("AUTOMATIC"), 86_400_000); }, next.getTime() - now.getTime());
};
scheduleDailyBackup();
app.listen(Number(process.env.PORT ?? 3001), () => console.log("Library v2 API listening"));
