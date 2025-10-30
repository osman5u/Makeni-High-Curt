import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { wsEmit } from '@/lib/websocket';

export const runtime = 'nodejs';

// POST /api/admin/broadcast-announcement
// Body: { message: string, targetRoles?: ('client' | 'lawyer')[] }
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded?.userId || !(decoded.role === 'admin' || decoded.is_superuser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const message = (body?.message ?? '').trim();
    const targetRoles: ('client' | 'lawyer')[] = Array.isArray(body?.targetRoles) && body.targetRoles.length
      ? body.targetRoles
      : ['client', 'lawyer'];

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Ensure Notification.case_id is nullable (defensive fix for legacy NOT NULL schema)
    try {
      const nullableCheck: Array<{ is_nullable: string }> = await prisma.$queryRaw`
        SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Notification' AND column_name = 'case_id'
      `;
      if (nullableCheck?.[0]?.is_nullable === 'NO') {
        await prisma.$executeRaw`
          ALTER TABLE "public"."Notification" ALTER COLUMN "case_id" DROP NOT NULL
        `;
      }
    } catch (schemaErr) {
      console.warn('Schema check/alter failed (continuing):', schemaErr);
    }

    // Fetch all active recipients matching roles
    const recipients = await prisma.user.findMany({
      where: {
        role: { in: targetRoles as any },
        is_active: true,
      },
      select: { id: true },
    });

    if (!recipients.length) {
      return NextResponse.json({ success: true, created: 0 });
    }

    const data = recipients.map((u) => ({
      message,
      recipient_id: u.id,
      sender_id: decoded.userId,
      // case_id left null for general announcements
    }));

    try {
      const result = await prisma.notification.createMany({ data, skipDuplicates: false });

      // Push realtime events to all recipients without querying inserted IDs via WebSocket
      await Promise.all(recipients.map(async (u) => {
        try {
          wsEmit(`private-notifications-user-${u.id}`, 'notification-new', {
            message,
            recipient_id: u.id,
            sender_id: decoded.userId,
            case_id: null,
          });
          const unreadCount = await prisma.notification.count({ where: { recipient_id: u.id, read: false } });
          wsEmit(`private-notifications-user-${u.id}`, 'notification-count', { count: unreadCount });
        } catch (e) {
          console.warn('WebSocket broadcast failed for user', u.id, e);
        }
      }));

      return NextResponse.json({ success: true, created: result.count });
    } catch (insertErr: any) {
      const msg = String(insertErr?.message || insertErr);
      if (msg.includes('null value in column') && msg.includes('case_id')) {
        try {
          await prisma.$executeRaw`
            ALTER TABLE "public"."Notification" ALTER COLUMN "case_id" DROP NOT NULL
          `;
          const retry = await prisma.notification.createMany({ data, skipDuplicates: false });

          await Promise.all(recipients.map(async (u) => {
            try {
              wsEmit(`private-notifications-user-${u.id}`, 'notification-new', {
                message,
                recipient_id: u.id,
                sender_id: decoded.userId,
                case_id: null,
              });
              const unreadCount = await prisma.notification.count({ where: { recipient_id: u.id, read: false } });
              wsEmit(`private-notifications-user-${u.id}`, 'notification-count', { count: unreadCount });
            } catch (e) {
              console.warn('WebSocket broadcast failed for user', u.id, e);
            }
          }));

          return NextResponse.json({ success: true, created: retry.count });
        } catch (retryErr: any) {
          console.error('Retry after dropping NOT NULL failed:', retryErr);
          return NextResponse.json({ error: retryErr?.message || 'Internal server error' }, { status: 500 });
        }
      }
      console.error('Error broadcasting announcement (insert failed):', insertErr);
      return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error broadcasting announcement:', error);
    const msg = String(error?.message || 'Internal server error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}