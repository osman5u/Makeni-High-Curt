import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || (user.role !== 'admin' && !user.is_superuser)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get total users using Prisma
    const totalUsers = await prisma.user.count();
    
    // Get total lawyers using Prisma
    const totalLawyers = await prisma.user.count({
      where: { role: 'lawyer' }
    });
    
    // Get total clients using Prisma
    const totalClients = await prisma.user.count({
      where: { role: 'client' }
    });
    
    // Get total cases using Prisma
    const totalCases = await prisma.case.count();
    
    // Get pending cases using Prisma
    const pendingCases = await prisma.case.count({
      where: { status: 'pending' }
    });
    
    // Get approved cases using Prisma
    const approvedCases = await prisma.case.count({
      where: { status: 'approved' }
    });
    
    // Get rejected cases using Prisma
    const rejectedCases = await prisma.case.count({
      where: { status: 'rejected' }
    });

    // NEW: Get total case tracking history updates
    const trackingHistoryCount = await prisma.caseTrackingHistory.count();
    // NEW: Compute unique tracked cases count: union of cases with tracking history and cases with tracking fields/outcome
    const historyCaseIdsRows: Array<{ case_id: number }> = await prisma.$queryRaw`SELECT DISTINCT "case_id" FROM "CaseTrackingHistory"`;
    const fieldTrackedCases = await prisma.case.findMany({
      where: {
        OR: [
          { court_start_date: { not: null } },
          { decision_deadline: { not: null } },
          { progress: { not: null } },
          { outcome: { in: ['won', 'lost'] } },
        ],
      },
      select: { id: true },
    });
    const idSet = new Set<number>();
    historyCaseIdsRows.forEach((row) => { if (typeof row.case_id === 'number') idSet.add(row.case_id); });
    fieldTrackedCases.forEach((c: { id: number }) => { if (typeof c.id === 'number') idSet.add(c.id); });
    const trackedCasesCount = idSet.size;

    return NextResponse.json({
      totalUsers,
      totalLawyers,
      totalClients,
      totalCases,
      pendingCases,
      approvedCases,
      rejectedCases,
      trackingHistoryCount,
      trackedCasesCount,
    }, { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
