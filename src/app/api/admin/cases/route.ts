import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || (user.role !== 'admin' && !user.is_superuser)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Optional filtering by outcome
    const url = new URL(request.url);
    const outcomeParam = url.searchParams.get('outcome');
    const allowedOutcomes = ['pending', 'won', 'lost'] as const;

    const where: any = {};
    if (outcomeParam && allowedOutcomes.includes(outcomeParam as any)) {
      where.outcome = outcomeParam as any;
    }

    const cases = await prisma.case.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        client: { select: { full_name: true } },
        lawyer: { select: { full_name: true } },
      },
    });

    const formatted = cases.map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status,
      created_at: c.created_at,
      due_date: c.due_date,
      court_start_date: c.court_start_date,
      decision_deadline: c.decision_deadline,
      outcome: c.outcome,
      progress: c.progress,
      client_id: c.client_id,
      lawyer_id: c.lawyer_id,
      client_name: c.client?.full_name || null,
      lawyer_name: c.lawyer?.full_name || null,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching cases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}