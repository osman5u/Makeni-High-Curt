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

    // Get recent users using Prisma
    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: {
        created_at: 'desc'
      },
      select: {
        id: true,
        username: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        created_at: true
      }
    });

    return NextResponse.json(
      recentUsers,
      { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('Error fetching recent users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
