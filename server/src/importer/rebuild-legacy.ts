/**
 * Removes only v2 rows explicitly marked as imported from a legacy snapshot.
 * It refuses to run without --confirm-rebuild.  The legacy database is never
 * contacted; run import-snapshot.ts afterwards to reload the SQL snapshot.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma.js";

if (!process.argv.includes("--confirm-rebuild")) {
  throw new Error("Refusing to delete data. Re-run with --confirm-rebuild after approving a legacy-data rebuild.");
}

try {
  const removed = await prisma.$transaction(async tx => {
    // Child rows first. Every predicate selects only records created from a
    // legacy source identity; ordinary v2 records have a null legacy ID/key.
    const fines = await tx.fine.deleteMany({ where: { legacyId: { not: null } } });
    const reservations = await tx.reservation.deleteMany({ where: { legacyId: { not: null } } });
    const loans = await tx.loan.deleteMany({ where: { legacyId: { not: null } } });
    const contributors = await tx.titleContributor.deleteMany({ where: { legacyId: { not: null } } });
    const copies = await tx.copy.deleteMany({ where: { legacyId: { not: null } } });
    const members = await tx.member.deleteMany({ where: { legacyId: { not: null } } });
    const staff = await tx.staff.deleteMany({ where: { legacyId: { not: null } } });
    const titles = await tx.bookTitle.deleteMany({ where: { legacyKey: { not: null } } });
    const authors = await tx.author.deleteMany({ where: { legacyId: { not: null } } });
    const corporates = await tx.corporateContributor.deleteMany({ where: { legacyId: { not: null } } });
    const publishers = await tx.publisher.deleteMany({ where: { legacyId: { not: null } } });
    return { fines: fines.count, reservations: reservations.count, loans: loans.count, contributors: contributors.count, copies: copies.count, members: members.count, staff: staff.count, authors: authors.count, corporates: corporates.count, publishers: publishers.count, titles: titles.count };
  });
  console.log(JSON.stringify({ removed }, null, 2));
} finally {
  await prisma.$disconnect();
}
