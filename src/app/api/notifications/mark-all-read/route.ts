import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { wsEmit } from '@/lib/websocket';
export const runtime = 'nodejs';

 const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: number;
  role: string;
  is_superuser?: boolean;
}

// PUT /api/notifications/mark-all-read - Mark all notifications as read
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('@/lib/auth');
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: { recipient_id: decoded.userId, read: false },
      data: { read: true, updated_at: new Date() },
    });

  // Push updated unread count to the user channel
  const unreadCount = await prisma.notification.count({ where: { recipient_id: decoded.userId, read: false } });
  wsEmit(`private-notifications-user-${decoded.userId}`, 'notification-count', { count: unreadCount });

  return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}