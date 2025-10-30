import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { wsEmit } from '@/lib/websocket';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: number;
  role: string;
  is_superuser?: boolean;
}

// GET /api/notifications - Get user's notifications (paginated)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verifyToken } = await import('@/lib/auth');
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const cursorCreatedAtParam = url.searchParams.get('cursorCreatedAt');

    // Smaller default page improves first paint
    let take = 20;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        take = Math.min(parsed, 100); // hard cap to 100
      }
    }

    const cursorDate = cursorCreatedAtParam ? new Date(cursorCreatedAtParam) : null;
    // Flattened raw SQL with selective LEFT JOINs for faster retrieval
    const rows = await prisma.$queryRaw(
      Prisma.sql`SELECT 
        n.id,
        n.case_id,
        n.message,
        n.read,
        n.recipient_id,
        n.sender_id,
        n.created_at,
        n.updated_at,
        c.title AS case_title,
        s.full_name AS sender_name
      FROM "Notification" n
      LEFT JOIN "Case" c ON c.id = n.case_id
      LEFT JOIN "User" s ON s.id = n.sender_id
      WHERE n.recipient_id = ${decoded.userId}
        ${cursorDate && !Number.isNaN(cursorDate.getTime()) ? Prisma.sql`AND n.created_at < ${cursorDate}` : Prisma.sql``}
      ORDER BY n.created_at DESC
      LIMIT ${take}`
    ) as any[];

    // Flatten server response for lighter payloads and simpler client rendering
    const notifications = rows.map((n) => ({
      id: n.id,
      case_id: n.case_id,
      message: n.message,
      read: n.read,
      recipient_id: n.recipient_id,
      sender_id: n.sender_id,
      created_at: n.created_at,
      updated_at: n.updated_at,
      case_title: n.case_title ?? null,
      sender_name: n.sender_name ?? null,
    }));

    // Provide a cursor for pagination and add short-lived caching
    const nextCursor = notifications.length === take ? notifications[notifications.length - 1]?.created_at : null;
    return NextResponse.json(
      { notifications, nextCursor },
      { status: 200, headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verifyToken } = await import('@/lib/auth');
    const decoded = verifyToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Safely parse JSON body; tolerate empty body
    let notificationId: number | undefined;
    let markAllAsRead: boolean | undefined;
    try {
      const body = await request.json();
      notificationId = body?.notificationId;
      markAllAsRead = body?.markAllAsRead;
    } catch (_) {
      notificationId = undefined;
      markAllAsRead = undefined;
    }

    if (markAllAsRead) {
      await prisma.notification.updateMany({
        where: { recipient_id: decoded.userId, read: false },
        data: { read: true, updated_at: new Date() },
      });
    } else if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, recipient_id: decoded.userId },
        data: { read: true, updated_at: new Date() },
      });
    } else {
      // No-op: missing payload; return success quickly
      // This prevents JSON parse errors and reduces server noise
    }

    // Push updated unread count to the user channel
    // Make Pusher updates non-blocking to improve response time
    (async () => {
      try {
        const unreadCount = await prisma.notification.count({
          where: { recipient_id: decoded.userId, read: false },
        });
        wsEmit(`private-notifications-user-${decoded.userId}`, 'notification-count', { count: unreadCount });
      } catch (e) {
        console.warn('Failed to push notification-count update:', e);
      }
    })();

    return NextResponse.json({ success: true });
   } catch (error) {
     console.error('Error updating notifications:', error);
     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
   }
 }