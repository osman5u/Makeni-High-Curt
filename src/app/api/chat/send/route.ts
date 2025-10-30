import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { MessageStatusEnum } from '@prisma/client';
import { wsEmit } from '@/lib/websocket';

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

    const { roomId, content, messageType = 'text', filePath, replyTo } = await request.json();

    // Verify user has access to this room
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { client_id: decoded.userId },
          { lawyer_id: decoded.userId }
        ]
      },
      include: {
        client: { select: { id: true, full_name: true, profile_picture: true } },
        lawyer: { select: { id: true, full_name: true, profile_picture: true } }
      }
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chat_room_id: roomId,
        sender_id: decoded.userId,
        message_type: messageType,
        content,
        file_path: filePath ?? null
      },
      include: {
        sender: { select: { id: true, full_name: true, profile_picture: true } }
      }
    });

    // Create recipient status as 'sent' so unread counters work
    const recipientId = chatRoom.client_id === decoded.userId ? chatRoom.lawyer_id : chatRoom.client_id;
    await prisma.messageStatus.create({
      data: {
        message_id: message.id,
        recipient_id: recipientId,
        status: MessageStatusEnum.sent,
        updated_at: new Date(),
      },
    });

    // Update chat room's last message
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { updated_at: new Date() }
    });

    // Broadcast via WebSocket
    wsEmit(`private-chat-room-${roomId}`, 'new-message', {
      id: message.id,
      chat_room_id: message.chat_room_id,
      is_minimal: true,
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}