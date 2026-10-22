import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma.js";

const value = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const required = (name: string, candidate: string | undefined) => {
  if (!candidate?.trim()) throw new Error(`${name} is required.`);
  return candidate.trim();
};

async function main() {
  const employeeId = required("--employee-id", value("--employee-id"));
  const name = required("--name", value("--name"));
  const email = required("--email", value("--email")).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("--email must be a valid email address.");

  const rl = createInterface({ input, output });
  const password = (process.env.ADMIN_BOOTSTRAP_PASSWORD ?? await rl.question("Admin password (input is visible): ")).trim();
  rl.close();
  if (password.length < 12) throw new Error("The admin password must be at least 12 characters.");

  const existingAdmin = await prisma.staff.findFirst({ where: { role: "Admin" }, select: { id: true } });
  if (existingAdmin) throw new Error("An admin account already exists; bootstrap is only allowed for an empty staff database.");
  const existingIdentity = await prisma.staff.findFirst({ where: { OR: [{ employeeId }, { email }] }, select: { id: true } });
  if (existingIdentity) throw new Error("The employee ID or email is already in use.");

  const passwordHash = await bcrypt.hash(password, 12);
  const staff = await prisma.staff.create({ data: { employeeId, name, email, passwordHash, role: "Admin", status: "ACTIVE" }, select: { id: true, employeeId: true, email: true, role: true } });
  console.log(`Created the first ${staff.role} account: ${staff.email} (${staff.employeeId}).`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to create the admin account.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
