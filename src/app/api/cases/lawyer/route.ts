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

    // Await the user fetch and validate role
    const user = await getUserById(decoded.userId);
    if (!user || user.role !== 'lawyer') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Fetch cases for the lawyer with Prisma, including client and documents
    const rawCases = await prisma.case.findMany({
      where: { lawyer_id: user.id },
      orderBy: { created_at: 'desc' },
      include: {
        client: { select: { id: true, username: true, full_name: true } },
        documents: {
          orderBy: { uploaded_at: 'desc' },
          select: { id: true, file_path: true, original_name: true, uploaded_at: true, uploaded_by: true },
        },
      },
    });

    const formattedCases = rawCases.map((c: any) => ({
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
      client: {
        id: c.client.id,
        username: c.client.username,
        full_name: c.client.full_name,
      },
      documents: c.documents.map((doc: { id: string; file_path: string; original_name: string; uploaded_at: Date; uploaded_by: string }) => ({
        id: doc.id,
        file_path: doc.file_path,
        original_name: doc.original_name,
        uploaded_at: doc.uploaded_at,
        uploaded_by: doc.uploaded_by,
      })),
    }));

    return NextResponse.json(
      formattedCases,
      { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } }
    );
  } catch (error) {
    console.error('Error fetching lawyer cases:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
