import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const user = await getUserById(decoded.userId);
    if (!user || user.role !== 'client') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Fetch cases for the client with Prisma
    const rawCases = await prisma.case.findMany({
      where: { client_id: user.id },
      orderBy: { created_at: 'desc' },
      include: {
        lawyer: { select: { id: true, username: true, full_name: true, email: true } },
        documents: { select: { id: true } },
      },
    });

    const cases = rawCases.map((c: any) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      status: c.status,
      due_date: c.due_date,
      court_start_date: c.court_start_date,
      decision_deadline: c.decision_deadline,
      outcome: c.outcome,
      progress: c.progress,
      created_at: c.created_at,
      updated_at: c.updated_at,
      rejection_comment: c.rejection_comment,
      lawyer: {
        id: c.lawyer?.id ?? null,
        username: c.lawyer?.username ?? null,
        full_name: c.lawyer?.full_name ?? null,
        email: c.lawyer?.email ?? null,
      },
      documents: c.documents ?? [],
    }));

    return NextResponse.json(
      { cases },
      { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('Error fetching client cases:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
