import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // A URL is only needed by migrate/runtime; this placeholder permits client
  // generation in CI without a database or secret.
  datasource: { url: process.env.DATABASE_URL ?? "mysql://library_app:development-only@localhost:3308/library_v2" },
});
