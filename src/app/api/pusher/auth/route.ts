import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { verifyToken } from '@/lib/auth';

// Force Node.js runtime (Pusher server SDK requires Node environment)
export const runtime = 'nodejs';
// Avoid caching for auth responses
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: any;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      console.error('Auth token verification failed:', err);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Support both JSON and x-www-form-urlencoded bodies sent by pusher-js
    const contentType = request.headers.get('content-type') || '';
    let socket_id: string | null = null;
    let channel_name: string | null = null;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      socket_id = body?.socket_id || null;
      channel_name = body?.channel_name || null;
    } else {
      // pusher-js default: application/x-www-form-urlencoded
      const text = await request.text();
      const params = new URLSearchParams(text);
      socket_id = params.get('socket_id');
      channel_name = params.get('channel_name');
    }

    if (!socket_id || !channel_name) {
      return NextResponse.json({ error: 'Invalid auth payload' }, { status: 400 });
    }

    // Authorize private channels (chat rooms)
    if (channel_name.startsWith('private-chat-room-')) {
      const roomIdStr = channel_name.replace('private-chat-room-', '');
      const roomIdNum = Number(roomIdStr);
      if (!Number.isFinite(roomIdNum)) {
        return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
      }
      const prisma = (await import('@/lib/prisma')).default;
      try {
        const chatRoom = await prisma.chatRoom.findFirst({
          where: {
            id: roomIdNum,
            OR: [
              { client_id: decoded.userId },
              { lawyer_id: decoded.userId }
            ]
          }
        });
        if (!chatRoom) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch (err) {
        console.error('Prisma room lookup failed (private):', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }

    // Authorize presence channels (chat rooms presence tracking)
    if (channel_name.startsWith('presence-chat-room-')) {
      const roomIdStr = channel_name.replace('presence-chat-room-', '');
      const roomIdNum = Number(roomIdStr);
      if (!Number.isFinite(roomIdNum)) {
        return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });
      }
      const prisma = (await import('@/lib/prisma')).default;
      try {
        const chatRoom = await prisma.chatRoom.findFirst({
          where: {
            id: roomIdNum,
            OR: [
              { client_id: decoded.userId },
              { lawyer_id: decoded.userId }
            ]
          }
        });
        if (!chatRoom) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch (err) {
        console.error('Prisma room lookup failed (presence):', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }

    // Authorize private notifications channel per user
    if (channel_name.startsWith('private-notifications-user-')) {
      const userIdStr = channel_name.replace('private-notifications-user-', '');
      const userIdNum = Number(userIdStr);
      if (!Number.isFinite(userIdNum)) {
        return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
      }
      // Only allow a user to subscribe to their own notifications channel
      if (userIdNum !== decoded.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Ensure server-side Pusher env variables are present
    const requiredEnv = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'] as const;
    const missing = requiredEnv.filter((k) => !process.env[k]);
    if (missing.length) {
      console.error('Missing Pusher server env variables:', missing);
      return NextResponse.json({ error: 'Server misconfigured: missing Pusher env' }, { status: 500 });
    }

    let authPayload: any;
    try {
      if (channel_name.startsWith('presence-')) {
        // Presence channels require presence data
        authPayload = pusherServer.authorizeChannel(socket_id, channel_name, {
          user_id: decoded.userId.toString(),
          user_info: {
            id: decoded.userId,
            name: decoded.full_name || 'User'
          }
        });
      } else {
        // Private channels do not use presence data
        authPayload = pusherServer.authorizeChannel(socket_id, channel_name);
      }
    } catch (err) {
      console.error('Pusher authorizeChannel failed:', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json(authPayload);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}