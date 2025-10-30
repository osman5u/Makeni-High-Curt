import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getUserById } from '@/lib/auth';
import db from '@/lib/database';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = getUserById(decoded.userId);
    if (!user || user.role !== 'lawyer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const resolvedParams = await params;
    const caseId = parseInt(resolvedParams.id);
    const body = await request.json();
    const rejection_comment = (body?.rejection_comment || '').toString().trim();

    if (!rejection_comment) {
      return NextResponse.json({ error: 'Rejection comment is required' }, { status: 400 });
    }

    // Ensure case exists and is assigned to this lawyer
    const caseData = db.prepare('SELECT id, title, client_id, lawyer_id, status FROM cases WHERE id = ?').get(caseId);
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (caseData.lawyer_id !== user.id) {
      return NextResponse.json({ error: 'You are not assigned to this case' }, { status: 403 });
    }

    // Reject case
    db.prepare('UPDATE cases SET status = ?, rejection_comment = ?, updated_at = ? WHERE id = ?')
      .run('rejected', rejection_comment, new Date().toISOString(), caseId);

    // Optional: notify client
    try {
      db.prepare(`
        INSERT INTO notifications (case_id, message, recipient_id, sender_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        caseId,
        `Your case "${caseData.title}" has been rejected. Reason: ${rejection_comment}`,
        caseData.client_id,
        user.id,
        new Date().toISOString()
      );
    } catch {}

    return NextResponse.json({ message: 'Case rejected successfully' });
  } catch (error) {
    console.error('Error rejecting case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}