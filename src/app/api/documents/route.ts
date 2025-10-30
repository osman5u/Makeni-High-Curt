import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const limitParam = searchParams.get('limit');
    const cursorUploadedAtParam = searchParams.get('cursorUploadedAt');

    let take = 50;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        take = Math.min(parsed, 100);
      }
    }

    const where: any = {};
    if (decoded.role === 'client') {
      where.case = { client_id: decoded.userId };
    } else if (decoded.role === 'lawyer') {
      where.case = { lawyer_id: decoded.userId };
    } // admins and superusers: no restriction
    if (caseId) {
      where.case_id = parseInt(caseId);
    }
    if (cursorUploadedAtParam) {
      const cursorDate = new Date(cursorUploadedAtParam);
      if (!Number.isNaN(cursorDate.getTime())) {
        where.uploaded_at = { lt: cursorDate };
      }
    }

    const results = await prisma.document.findMany({
      where,
      orderBy: { uploaded_at: 'desc' },
      take,
      include: {
        case: { select: { title: true, status: true } },
        uploader: { select: { full_name: true } },
      },
    });

    const documents = results.map(({ case: caseRel, uploader, ...doc }: any) => ({
      ...doc,
      case_title: caseRel?.title,
      case_status: caseRel?.status,
      uploaded_by_name: uploader?.full_name,
    }));

    const nextCursorUploadedAt = results.length === take ? results[results.length - 1].uploaded_at : null;

    return NextResponse.json(
      { documents, nextCursorUploadedAt },
      { headers: { 'Cache-Control': 'private, max-age=15, must-revalidate' } }
    );
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}