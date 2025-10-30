import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Auth: support header or cookie, consistent with other endpoints
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const documentId = parseInt(params.id);
    if (!documentId || Number.isNaN(documentId)) {
      return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
    }

    // Get document info and related case for permission checks
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: { select: { client_id: true, lawyer_id: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (!document.file_path) {
      return NextResponse.json({ error: 'Document file path not found' }, { status: 404 });
    }

    // Permissions: admin, uploader, assigned lawyer, or client owner
    const canDownload =
      decoded.role === 'admin' ||
      decoded.is_superuser ||
      document.uploaded_by === decoded.userId ||
      (decoded.role === 'lawyer' && document.case?.lawyer_id === decoded.userId) ||
      (decoded.role === 'client' && document.case?.client_id === decoded.userId);

    if (!canDownload) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Read file and return as attachment
    const filePath = join(process.cwd(), document.file_path);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found on server' }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const headers = new Headers();
    const downloadName = document.original_name || 'document';
    headers.set('Content-Disposition', `attachment; filename="${downloadName}"`);
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Length', String(fileBuffer.length));

    try {
      const uid = Number(decoded.userId);
      if (uid && Number.isFinite(uid)) {
        await prisma.documentView.upsert({
          where: { document_id_user_id: { document_id: documentId, user_id: uid } },
          update: { viewed_at: new Date() },
          create: { document_id: documentId, user_id: uid },
        });
      }
    } catch (e) {
      console.error('Failed to log document download view:', e);
    }

    return new NextResponse(fileBuffer as any, { headers });
  } catch (error) {
    console.error('Error downloading document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}