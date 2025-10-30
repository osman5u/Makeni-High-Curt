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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get available lawyers (Prisma)
    const lawyers = await prisma.user.findMany({
      where: {
        role: 'lawyer',
        is_active: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        full_name: true,
        profile_picture: true,
        role: true,
        is_active: true,
      },
      orderBy: { full_name: 'asc' },
    });

    return NextResponse.json(lawyers);
  } catch (error) {
    console.error('Error fetching lawyers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
