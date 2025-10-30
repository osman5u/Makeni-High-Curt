import prisma from './prisma';

// Prisma shim replacing the legacy SQLite helper.
// Existing code importing "@/lib/database" will now receive the Prisma client.
export default prisma;

export function getDatabase() {
  return prisma;
}
