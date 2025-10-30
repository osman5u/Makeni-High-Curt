import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await request.json();
    const documentId = parseInt(id);
    if (!documentId || Number.isNaN(documentId)) {
      return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
    }

    const documentQuery = db.prepare(`
      SELECT d.*, c.client_id, c.lawyer_id 
      FROM documents d 
      JOIN cases c ON d.case_id = c.id 
      WHERE d.id = ?
    `);
    const document = documentQuery.get(documentId);
    if (!document || !document.file_path) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const canView =
      decoded.role === 'admin' ||
      document.uploaded_by === decoded.userId ||
      (decoded.role === 'lawyer' && document.lawyer_id === decoded.userId) ||
      (decoded.role === 'client' && document.client_id === decoded.userId);

    if (!canView) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const previewToken = jwt.sign({ docId: documentId, uid: decoded.userId }, JWT_SECRET, { expiresIn: '5m' });
    const origin = request.nextUrl.origin;
    const previewUrl = `${origin}/api/documents/preview/${documentId}?token=${encodeURIComponent(previewToken)}`;

    return NextResponse.json({ token: previewToken, previewUrl });
  } catch (error) {
    console.error('Error creating preview token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}