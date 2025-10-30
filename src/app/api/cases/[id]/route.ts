import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/database';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const resolvedParams = await params;
    const caseId = parseInt(resolvedParams.id);
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        due_date: true,
        created_at: true,
        updated_at: true,
        client_id: true,
        lawyer_id: true,
      },
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json(caseData);
  } catch (error) {
    console.error('Error fetching case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    const resolvedParams = await params;
    const caseId = parseInt(resolvedParams.id);
    const existing = await prisma.case.findUnique({
      where: { id: caseId },
      select: { client_id: true, lawyer_id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.is_superuser;
    const isClientOwner = existing.client_id === user.userId;
    const isAssignedLawyer = existing.lawyer_id === user.userId;

    if (!(isAdmin || isClientOwner || isAssignedLawyer)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Restrict updates to pending cases only
    if (existing.status !== 'pending') {
      const msg = existing.status === 'approved'
        ? 'This case is already approved; you cannot make changes'
        : 'This case is rejected; you cannot make changes';
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    const payload = await request.json();

    const data: any = {};
    if (payload.title) data.title = payload.title;
    if (payload.description) data.description = payload.description;
    if (payload.due_date) data.due_date = new Date(payload.due_date);
    if (isAdmin && payload.lawyer_id) data.lawyer_id = Number(payload.lawyer_id);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.case.update({
      where: { id: caseId },
      data,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        due_date: true,
        client_id: true,
        lawyer_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const resolvedParams = await params;
    const caseId = parseInt(resolvedParams.id);
    const existing = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, client_id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.is_superuser;
    const isClientOwner = existing.client_id === user.userId;

    if (!(isAdmin || isClientOwner)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (isClientOwner && existing.status === 'approved') {
      return NextResponse.json({ error: 'This case is already approved and can only be deleted by admin' }, { status: 403 });
    }

    // Manually delete dependent records to satisfy FK constraints
    await prisma.$transaction(async (tx) => {
      // Chat room and messages
      const chatRoom = await tx.chatRoom.findUnique({ where: { case_id: caseId }, select: { id: true } });
      if (chatRoom) {
        const messages = await tx.message.findMany({ where: { chat_room_id: chatRoom.id }, select: { id: true } });
        const messageIds = messages.map(m => m.id);
        if (messageIds.length) {
          await tx.messageStatus.deleteMany({ where: { message_id: { in: messageIds } } });
          await tx.message.deleteMany({ where: { id: { in: messageIds } } });
        }
        await tx.chatRoom.delete({ where: { id: chatRoom.id } });
      }

      // Documents and views
      const docs = await tx.document.findMany({ where: { case_id: caseId }, select: { id: true } });
      const docIds = docs.map(d => d.id);
      if (docIds.length) {
        await tx.documentView.deleteMany({ where: { document_id: { in: docIds } } });
        await tx.document.deleteMany({ where: { id: { in: docIds } } });
      }

      // Notifications
      await tx.notification.deleteMany({ where: { case_id: caseId } });
      
      // Tracking history
      await tx.caseTrackingHistory.deleteMany({ where: { case_id: caseId } });

      // Finally, delete the case
      await tx.case.delete({ where: { id: caseId } });
    });

    return NextResponse.json({ message: 'Case deleted successfully' });
  } catch (error) {
    console.error('Error deleting case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}