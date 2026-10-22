import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!url.hostname) throw new Error("DATABASE_URL must be configured.");
const adapter = new PrismaMariaDb({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), connectionLimit: 10 });
export const prisma = new PrismaClient({ adapter });
