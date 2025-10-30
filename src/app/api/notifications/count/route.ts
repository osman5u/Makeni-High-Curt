import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const count = await prisma.notification.count({
      where: { recipient_id: decoded.userId, read: false },
    });

    return NextResponse.json({ count }, { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}