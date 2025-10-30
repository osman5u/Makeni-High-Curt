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

    // Get case statistics for the last 6 months using PostgreSQL
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const caseStatsRaw = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT 
        to_char(created_at, 'YYYY-MM') AS month,
        COUNT(*) AS count
      FROM "Case"
      WHERE created_at >= ${sixMonthsAgo}
      GROUP BY to_char(created_at, 'YYYY-MM')
      ORDER BY month
    `;

    const caseStats = caseStatsRaw.map(item => ({
      month: item.month,
      count: Number(item.count)
    }));

    return NextResponse.json(caseStats);
  } catch (error) {
    console.error('Error fetching case stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
