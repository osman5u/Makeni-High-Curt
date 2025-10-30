const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const ids = process.argv.slice(2).map(Number).filter(Boolean);
    if (!ids.length) {
      console.log('Usage: node scripts/seed-history.js <caseId1> <caseId2> ...');
      process.exit(1);
    }
    const admin = await prisma.user.findFirst({ where: { OR: [{ role: 'admin' }, { is_superuser: true }] }, orderBy: { id: 'asc' } });
    if (!admin) {
      console.error('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    for (const caseId of ids) {
      const cs = await prisma.case.findUnique({ where: { id: caseId } });
      if (!cs) {
        console.warn(`Case ${caseId} not found, skipping.`);
        continue;
      }
      const entry = await prisma.caseTrackingHistory.create({
        data: {
          case_id: caseId,
          updated_by_id: admin.id,
          court_start_date: cs.court_start_date ?? new Date(),
          decision_deadline: cs.decision_deadline ?? new Date(Date.now() + 86400000),
          outcome: cs.outcome,
          progress: cs.progress ?? 'Initial seed progress',
          changes: 'Seeded history entry for testing',
        },
      });
      console.log(`Inserted history id=${entry.id} for case ${caseId} by user ${admin.id}`);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();