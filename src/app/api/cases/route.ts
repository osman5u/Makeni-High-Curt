import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { wsEmit } from '@/lib/websocket';
import { sendNewCaseEmailToLawyer } from '@/lib/email';

export const runtime = 'nodejs';

// POST /api/cases - Create new case and notify assigned lawyer
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, description, lawyer_id, due_date } = body || {};
    if (!title || !lawyer_id || !due_date) {
      return NextResponse.json({ error: 'title, lawyer_id and due_date are required' }, { status: 400 });
    }
    const parsedDueDate = new Date(due_date);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: 'Invalid due_date' }, { status: 400 });
    }

    const newCase = await prisma.case.create({
      data: {
        title,
        description: description || '',
        client_id: decoded.userId,
        lawyer_id: Number(lawyer_id),
        due_date: parsedDueDate,
      },
    });

    const notification = await prisma.notification.create({
      data: {
        recipient_id: Number(lawyer_id),
        sender_id: decoded.userId,
        case_id: newCase.id,
        message: `A new case "${title}" has been created and assigned to you.`,
      },
    });

    // Emit to lawyer's private channel
    wsEmit(`private-notifications-user-${Number(lawyer_id)}`, 'notification-created', {
      id: notification.id,
      recipient_id: notification.recipient_id,
      sender_id: notification.sender_id,
      case_id: notification.case_id,
      message: notification.message,
      created_at: notification.created_at,
      read: notification.read,
    });

    const unreadCount = await prisma.notification.count({ where: { recipient_id: Number(lawyer_id), read: false } });
    wsEmit(`private-notifications-user-${Number(lawyer_id)}`, 'notification-count', { count: unreadCount });

    // Send email notification to the assigned lawyer
    try {
      const lawyer = await prisma.user.findUnique({
        where: { id: Number(lawyer_id) },
        select: { email: true, full_name: true },
      });
      const client = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { full_name: true },
      });
      if (lawyer?.email) {
        await sendNewCaseEmailToLawyer({
          to: lawyer.email,
          lawyerName: lawyer.full_name || 'Lawyer',
          caseTitle: newCase.title,
          clientName: client?.full_name || 'Client',
          dueDate: newCase.due_date,
        });
      }
    } catch (emailErr) {
      console.warn('Failed to send new case email to lawyer:', emailErr);
    }

    return NextResponse.json({ success: true, case: newCase });
  } catch (error) {
    console.error('Error creating case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
