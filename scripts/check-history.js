const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const ids = process.argv.slice(2).map(Number);
    if (!ids.length) {
      console.log('Usage: node scripts/check-history.js <caseId1> <caseId2> ...');
      process.exit(1);
    }
    for (const id of ids) {
      const count = await prisma.caseTrackingHistory.count({ where: { case_id: id } });
      console.log(`case ${id} history count: ${count}`);
      if (count) {
        const rows = await prisma.caseTrackingHistory.findMany({ where: { case_id: id }, orderBy: { created_at: 'desc' }, take: 5 });
        for (const r of rows) {
          console.log(`- id=${r.id} outcome=${r.outcome} created_at=${r.created_at?.toISOString?.()}`);
        }
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();