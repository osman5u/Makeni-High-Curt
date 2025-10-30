// Top-level imports in this file
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { MessageStatusEnum } from '@prisma/client';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = decoded.userId as number;
    
    const roomsRaw = await prisma.chatRoom.findMany({
      where: {
        OR: [{ client_id: userId }, { lawyer_id: userId }],
        case: { is: { status: 'approved' } },
      },
      include: {
        case: {
          select: { id: true, title: true, status: true },
        },
        client: {
          select: { id: true, full_name: true, profile_picture: true },
        },
        lawyer: {
          select: { id: true, full_name: true, profile_picture: true },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { content: true, created_at: true },
        },
      },
    });

    // Precompute unread counts in a single query to avoid N+1
    const statusRows = await prisma.messageStatus.findMany({
      where: {
        recipient_id: userId,
        status: { not: MessageStatusEnum.read },
      },
      include: {
        message: { select: { chat_room_id: true } },
      },
    });
    const unreadMap = new Map<number, number>();
    for (const row of statusRows) {
      const roomId = row.message?.chat_room_id;
      if (roomId) unreadMap.set(roomId, (unreadMap.get(roomId) || 0) + 1);
    }

    const rooms = roomsRaw.map((r: {
      id: number;
      case_id: number | null;
      client_id: number;
      lawyer_id: number;
      case?: { id: number; title: string; status: string } | null;
      client?: { id: number; full_name: string; profile_picture: string | null } | null;
      lawyer?: { id: number; full_name: string; profile_picture: string | null } | null;
      messages: Array<{ content: string; created_at: Date }>;
    }) => {
      const last = r.messages[0] || null;

      // Use precomputed unread count
      const unread_count = unreadMap.get(r.id) || 0;

      // Determine "other" participant for UI
      const isClient = r.client_id === userId;
      const other = isClient ? r.lawyer : r.client;

      return {
        id: r.id,
        case_id: r.case_id,
        client_id: r.client_id,
        lawyer_id: r.lawyer_id,
        case_title: r.case?.title ?? null,
        case_status: r.case?.status ?? null,
        other_full_name: other?.full_name ?? null,
        other_profile_picture: other?.profile_picture ?? null,
        last_content: last?.content ?? null,
        last_time: last?.created_at ?? null,
        unread_count,
      };
    });

    // Sort by last_time DESC with nulls last to mimic the SQL ORDER BY
    rooms.sort((a, b) => {
      if (!a.last_time && !b.last_time) return 0;
      if (!a.last_time) return 1;
      if (!b.last_time) return -1;
      return new Date(b.last_time as any).getTime() - new Date(a.last_time as any).getTime();
    });

    return NextResponse.json({ rooms });
  } catch (e) {
    console.error('Rooms GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}