import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import db from '@/lib/database';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function getMimeType(filename: string) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    case 'svg': return 'image/svg+xml';
    case 'txt': return 'text/plain; charset=utf-8';
    case 'csv': return 'text/csv; charset=utf-8';
    case 'json': return 'application/json';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt': return 'application/vnd.ms-powerpoint';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    default: return 'application/octet-stream';
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { id } = await params;
    const documentId = parseInt(id);
    if (!documentId || Number.isNaN(documentId) || payload.docId !== documentId) {
      return NextResponse.json({ error: 'Invalid token scope' }, { status: 403 });
    }

    const document = db
      .prepare(`SELECT d.* FROM documents d WHERE d.id = ?`)
      .get(documentId);

    if (!document || !document.file_path) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const filePath = join(process.cwd(), document.file_path);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const response = new NextResponse(fileBuffer);
    const filename = document.original_name || 'document';

    response.headers.set('Content-Disposition', `inline; filename="${filename}"`);
    response.headers.set('Content-Type', getMimeType(filename));
    response.headers.set('Content-Length', fileBuffer.length.toString());
    response.headers.set('Cache-Control', 'private, max-age=60');

    try {
      const uid = Number(payload.uid);
      if (uid && Number.isFinite(uid)) {
        await prisma.documentView.upsert({
          where: { document_id_user_id: { document_id: documentId, user_id: uid } },
          update: { viewed_at: new Date() },
          create: { document_id: documentId, user_id: uid },
        });
      }
    } catch (e) {
      console.error('Failed to log document preview view:', e);
    }

    return response;
  } catch (error) {
    console.error('Error previewing document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}