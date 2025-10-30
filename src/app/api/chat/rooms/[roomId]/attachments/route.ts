import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const roomIdNum = parseInt(roomId);

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = decoded.userId as number;

    // Use Prisma instead of legacy SQLite helper
    const room = await prisma.chatRoom.findUnique({
      where: { id: roomIdNum },
      select: { id: true, client_id: true, lawyer_id: true },
    });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    if (room.client_id !== userId && room.lawyer_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 });

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'chat');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const originalName = file.name;
    const extension = originalName.split('.').pop();
    const filename = `${timestamp}-${Math.random().toString(36).slice(2)}.${extension}`;
    const filepath = join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Return the stored relative path and original name
    return NextResponse.json({
      file_path: `uploads/chat/${filename}`,
      original_name: originalName,
    });
  } catch (e) {
    console.error('Attachment upload error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}