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

    // Get available lawyers using Prisma
    const lawyers = await prisma.user.findMany({
      where: {
        role: 'lawyer',
        is_active: true
      },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        is_active: true
      },
      orderBy: {
        full_name: 'asc'
      }
    });

    return NextResponse.json(lawyers);
  } catch (error) {
    console.error('Error fetching available lawyers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
