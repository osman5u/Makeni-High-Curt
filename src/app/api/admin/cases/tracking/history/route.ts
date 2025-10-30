import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/admin/cases/tracking/history?outcome=pending|won|lost (optional)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded?.userId || !(decoded.role === 'admin' || decoded.is_superuser)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(request.url);
    const outcomeParam = url.searchParams.get('outcome');
    const allowed = ['pending', 'won', 'lost'];

    let histories;
    if (outcomeParam && allowed.includes(outcomeParam)) {
      histories = await prisma.caseTrackingHistory.findMany({
        where: { outcome: outcomeParam as any },
        orderBy: { created_at: 'desc' },
        include: {
          updated_by: { select: { id: true, full_name: true, username: true } },
          case: { select: { title: true } },
        },
      });
    } else {
      histories = await prisma.caseTrackingHistory.findMany({
        orderBy: { created_at: 'desc' },
        include: {
          updated_by: { select: { id: true, full_name: true, username: true } },
          case: { select: { title: true } },
        },
      });
    }

    const history = histories.map((h) => ({
      id: h.id,
      case_id: h.case_id,
      case_title: h.case?.title ?? null,
      updated_by_id: h.updated_by_id,
      updated_by: h.updated_by,
      court_start_date: h.court_start_date,
      decision_deadline: h.decision_deadline,
      outcome: h.outcome,
      progress: h.progress,
      changes: h.changes,
      created_at: h.created_at,
      updated_at: h.updated_at,
    }));

    return NextResponse.json({ history }, { status: 200 });
  } catch (error) {
    console.error('Error fetching case tracking history:', error);
    return NextResponse.json({ error: 'Failed to fetch tracking history' }, { status: 500 });
  }
}