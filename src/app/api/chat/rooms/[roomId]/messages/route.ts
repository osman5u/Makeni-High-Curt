import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { MessageStatusEnum } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = decoded.userId as number;

    // Await params to access roomId
    const { roomId } = await params;
    const roomIdNum = Number(roomId);
    if (Number.isNaN(roomIdNum)) {
      return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
    }

    // Verify room exists
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomIdNum },
      select: { id: true, client_id: true, lawyer_id: true },
    });
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    if (userId !== room.client_id && userId !== room.lawyer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: { chat_room_id: roomIdNum },
      orderBy: { created_at: 'desc' },
      take: 200, // cap to latest 200 messages for performance
    });

    // Return in ascending order for UI after limiting
    const ordered = messages.slice().reverse();
    return NextResponse.json({ messages: ordered }, { status: 200 });
  } catch (err) {
    console.error('Messages GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const roomIdNum = Number(roomId);
    if (Number.isNaN(roomIdNum)) {
      return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = decoded.userId as number;

    // Verify room exists and membership
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomIdNum },
      select: { id: true, client_id: true, lawyer_id: true },
    });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (room.client_id !== userId && room.lawyer_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { message_type, content, file_path } = body as {
      message_type: 'text' | 'file' | 'image';
      content: string;
      file_path?: string | null;
    };
    if (!message_type || (!content && !file_path)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const recipientId = room.client_id === userId ? room.lawyer_id : room.client_id;

    // Create message
    const created = await prisma.message.create({
      data: {
        chat_room_id: roomIdNum,
        sender_id: userId,
        message_type: message_type as any, // 'text' | 'file' | 'image' per schema enum
        content,
        file_path: file_path ?? null,
      },
    });

    // Create recipient status as 'sent'
    await prisma.messageStatus.create({
      data: {
        message_id: created.id,
        recipient_id: recipientId,
        status: MessageStatusEnum.sent,
        updated_at: new Date(),
      },
    });

    // Return the created message
    return NextResponse.json({ message: created }, { status: 201 });
  } catch (e) {
    console.error('Messages POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}