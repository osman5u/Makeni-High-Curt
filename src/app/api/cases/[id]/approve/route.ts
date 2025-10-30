import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { wsEmit } from '@/lib/websocket';
import { sendCaseApprovedEmailToClient } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = await getUserById(decoded.userId);
    if (!user || user.role !== 'lawyer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const caseId = parseInt(id, 10);
    if (!Number.isFinite(caseId)) {
      return NextResponse.json({ error: 'Invalid case id' }, { status: 400 });
    }

    // Ensure case exists and is assigned to this lawyer
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, title: true, client_id: true, lawyer_id: true, status: true },
    });
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseData.lawyer_id !== user.id) {
      return NextResponse.json({ error: 'You are not assigned to this case' }, { status: 403 });
    }

    // Check if case has any documents
    const docCount = await prisma.document.count({ where: { case_id: caseId } });
    if (docCount < 1) {
      return NextResponse.json({
        error: 'Cannot approve: This case has no documents uploaded. Please ask the client to upload required documents first.'
      }, { status: 400 });
    }

    // Require at least one viewed or downloaded document before approval
    const viewedCount = await prisma.documentView.count({
      where: {
        user_id: user.id,
        document: { case_id: caseId },
      },
    });
    if (viewedCount < 1) {
      return NextResponse.json({
        error: 'Cannot approve: Please preview or download at least one document for this case before approving.'
      }, { status: 400 });
    }

    // Approve case
    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'approved', rejection_comment: null },
    });

    // Auto-create chat room if not exists (case_id is UNIQUE)
    await prisma.chatRoom.upsert({
      where: { case_id: caseId },
      update: { updated_at: new Date() },
      create: {
        case_id: caseId,
        client_id: caseData.client_id,
        lawyer_id: caseData.lawyer_id,
      },
    });

    // Notify client (in-app and real-time)
    const notif = await prisma.notification.create({
      data: {
        case_id: caseId,
        message: `Your case "${caseData.title}" has been approved.`,
        recipient_id: caseData.client_id,
        sender_id: user.id,
      },
    });

    wsEmit(`private-notifications-user-${Number(caseData.client_id)}`, 'notification-created', {
      id: notif.id,
      case_id: caseId,
      message: `Your case "${caseData.title}" has been approved.`,
      read: notif.read,
      recipient_id: Number(caseData.client_id),
      sender_id: user.id,
      created_at: notif.created_at,
      updated_at: notif.updated_at,
      case_title: caseData.title,
      sender_name: (user as any).full_name || 'Lawyer',
    });
    const unreadCount = await prisma.notification.count({ where: { recipient_id: Number(caseData.client_id), read: false } });
    wsEmit(`private-notifications-user-${Number(caseData.client_id)}`, 'notification-count', { count: unreadCount });

    // Send email notification to the client
    try {
      const client = await prisma.user.findUnique({
        where: { id: caseData.client_id },
        select: { email: true, full_name: true },
      });
      if (client?.email) {
        await sendCaseApprovedEmailToClient({
          to: client.email,
          clientName: client.full_name || 'Client',
          caseTitle: caseData.title,
          lawyerName: (user as any).full_name || 'Lawyer',
        });
      }
    } catch (emailErr) {
      console.warn('Failed to send approval email to client:', emailErr);
    }

    return NextResponse.json({ message: 'Case approved successfully' });
  } catch (error) {
    console.error('Error approving case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}