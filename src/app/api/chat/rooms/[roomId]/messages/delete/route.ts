import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const roomIdNum = parseInt(roomId);
  const { messageIds } = await request.json();

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

  // Delete message statuses first
  await prisma.messageStatus.deleteMany({
    where: { message_id: { in: messageIds } },
  });

  // Delete messages (only if user is the sender or admin)
  await prisma.message.deleteMany({
    where: {
      id: { in: messageIds },
      chat_room_id: roomIdNum,
      sender_id: userId, // Only allow deleting own messages
    },
  });

  return NextResponse.json({ ok: true });
}