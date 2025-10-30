import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const roomIdNum = parseInt(roomId);

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

  // Delete all messages and their statuses for this room
  await prisma.messageStatus.deleteMany({
    where: { message: { chat_room_id: roomIdNum } },
  });
  
  await prisma.message.deleteMany({
    where: { chat_room_id: roomIdNum },
  });

  return NextResponse.json({ ok: true });
}