import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { wsEmit } from '@/lib/websocket';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
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

    const { caseId, status } = await request.json();

    if (!caseId || !status) {
      return NextResponse.json({ error: 'Case ID and status are required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be pending, approved, or rejected' }, { status: 400 });
    }

    const caseData = await prisma.case.findUnique({
      where: { id: Number(caseId) },
      select: { id: true, title: true, client_id: true },
    });
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    await prisma.case.update({
      where: { id: Number(caseId) },
      data: { status },
    });

    const notif = await prisma.notification.create({
      data: {
        case_id: Number(caseId),
        message: `Your case "${caseData.title}" status has been updated to ${status}`,
        recipient_id: Number(caseData.client_id),
        sender_id: Number(user.userId),
      },
    });

    // Push real-time notification event and updated count to the recipient via WebSocket
    wsEmit(`private-notifications-user-${Number(caseData.client_id)}`, 'notification-created', {
      id: notif.id,
      case_id: Number(caseId),
      message: `Your case "${caseData.title}" status has been updated to ${status}`,
      read: notif.read,
      recipient_id: Number(caseData.client_id),
      sender_id: Number(user.userId),
      created_at: notif.created_at,
      updated_at: notif.updated_at,
      case_title: caseData.title,
      sender_name: (user as any).full_name || 'Admin',
    });
    const unreadCount = await prisma.notification.count({ where: { recipient_id: Number(caseData.client_id), read: false } });
    wsEmit(`private-notifications-user-${Number(caseData.client_id)}`, 'notification-count', { count: unreadCount });

    return NextResponse.json({ message: 'Case status updated successfully' });
  } catch (error) {
    console.error('Error updating case status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
