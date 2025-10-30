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

    // Get user role distribution using Prisma
    const roleDistribution = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    });

    // Get user registration trend for the last 6 months (PostgreSQL)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const registrationTrend = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT 
        to_char(created_at, 'YYYY-MM') AS month,
        COUNT(*) AS count
      FROM "User"
      WHERE created_at >= ${sixMonthsAgo}
      GROUP BY to_char(created_at, 'YYYY-MM')
      ORDER BY month
    `;

    return NextResponse.json({
      roleDistribution: roleDistribution.map((item: { role: string; _count: { role: number } }) => ({
        name: item.role.charAt(0).toUpperCase() + item.role.slice(1),
        value: item._count.role
      })),
      registrationTrend: registrationTrend.map((item: { month: string; count: bigint }) => ({
        month: item.month,
        count: Number(item.count)
      }))
    }, { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
