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

    // Get recent cases with client and lawyer names using Prisma
    const recentCases = await prisma.case.findMany({
      take: 5,
      orderBy: {
        created_at: 'desc'
      },
      include: {
        client: {
          select: {
            full_name: true
          }
        },
        lawyer: {
          select: {
            full_name: true
          }
        }
      }
    });

    // Transform the data to match expected format
    const formattedCases = recentCases.map((case_: any) => ({
      id: case_.id,
      title: case_.title,
      description: case_.description,
      status: case_.status,
      created_at: case_.created_at,
      client_name: case_.client?.full_name || null,
      lawyer_name: case_.lawyer?.full_name || null
    }));

    return NextResponse.json(
      formattedCases,
      { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('Error fetching recent cases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
