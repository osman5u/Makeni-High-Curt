import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// GET /api/admin/cases/[id]/tracking/history
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const caseId = Number(params.id);
    if (!caseId || Number.isNaN(caseId)) {
      return NextResponse.json({ error: 'Invalid case id' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<any[]>(
      Prisma.sql`SELECT h.id, h.case_id, h.updated_by_id, h.court_start_date, h.decision_deadline, h.outcome, h.progress, h.changes, h.created_at, h.updated_at,
                        u.full_name AS updated_by_full_name, u.username AS updated_by_username
                 FROM "CaseTrackingHistory" h
                 JOIN "User" u ON u.id = h.updated_by_id
                 WHERE h.case_id = ${caseId}
                 ORDER BY h.created_at DESC`
    );

    const history = rows.map((r: any) => ({
      id: r.id,
      case_id: r.case_id,
      updated_by_id: r.updated_by_id,
      court_start_date: r.court_start_date,
      decision_deadline: r.decision_deadline,
      outcome: r.outcome,
      progress: r.progress,
      changes: r.changes,
      created_at: r.created_at,
      updated_at: r.updated_at,
      updated_by: { id: r.updated_by_id, full_name: r.updated_by_full_name, username: r.updated_by_username },
    }));

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching tracking history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}