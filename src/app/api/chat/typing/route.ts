import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
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

    const { roomId, isTyping } = await request.json();

    // Broadcast typing event via WebSocket
    const eventName = isTyping ? 'typing-started' : 'typing-stopped';
    wsEmit(`private-chat-room-${roomId}`, eventName, {
      userId: decoded.userId,
      userName: decoded.full_name || 'User'
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Typing indicator error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}