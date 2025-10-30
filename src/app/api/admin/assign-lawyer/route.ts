import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { wsEmit } from '@/lib/websocket';

export const runtime = 'nodejs';

// POST /api/admin/assign-lawyer
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
    const { caseId, lawyerId } = body || {};
    if (!caseId || !lawyerId) {
      return NextResponse.json({ error: 'caseId and lawyerId are required' }, { status: 400 });
    }

    // Update case with assigned lawyer
    const updatedCase = await prisma.case.update({
      where: { id: Number(caseId) },
      data: { lawyer_id: Number(lawyerId) },
    });

    // Create notification for the assigned lawyer
    const notification = await prisma.notification.create({
      data: {
        recipient_id: Number(lawyerId),
        sender_id: decoded.userId,
        case_id: Number(caseId),
        message: `You have been assigned to case #${caseId}.`,
      },
    });

    // Emit notification-created and updated count via WebSocket
    wsEmit(`private-notifications-user-${Number(lawyerId)}`, 'notification-created', {
      id: notification.id,
      recipient_id: notification.recipient_id,
      sender_id: notification.sender_id,
      case_id: notification.case_id,
      message: notification.message,
      created_at: notification.created_at,
      read: notification.read,
    });

    const unreadCount = await prisma.notification.count({ where: { recipient_id: Number(lawyerId), read: false } });
    wsEmit(`private-notifications-user-${Number(lawyerId)}`, 'notification-count', { count: unreadCount });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error assigning lawyer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
