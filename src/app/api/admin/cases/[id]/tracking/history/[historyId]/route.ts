import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { generateCaseOutcomeReceipt } from '@/lib/pdf-receipt';
import { sendCaseOutcomeReceiptEmail } from '@/lib/email';
import path from 'path';

export const runtime = 'nodejs';

function parseDate(value?: string) {
  if (!value || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// PATCH /api/admin/cases/[id]/tracking/history/[historyId]
// Body: { court_start_date?: string, decision_deadline?: string, outcome?: 'pending'|'won'|'lost', progress?: string, changes?: string }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string, historyId: string }> }) {
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

    const { id, historyId } = await context.params;
    const caseId = Number(id);
    const historyIdNum = Number(historyId);
    if (!caseId || Number.isNaN(caseId) || !historyIdNum || Number.isNaN(historyIdNum)) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
    }

    const existingRows = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT id, case_id FROM "CaseTrackingHistory" WHERE id = ${historyIdNum} LIMIT 1`);
    const existing = existingRows[0];
    if (!existing || existing.case_id !== caseId) {
      return NextResponse.json({ error: 'History entry not found for this case' }, { status: 404 });
    }

    // Enforce: only approved cases can have history edited
    const parentCase = await prisma.case.findUnique({ where: { id: caseId }, select: { status: true } });
    if (!parentCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (parentCase.status !== 'approved') {
      return NextResponse.json({ error: 'History can only be edited for approved cases' }, { status: 400 });
    }

    const body = await request.json();
    const { court_start_date, decision_deadline, outcome, progress, changes } = body || {};
    const allowedOutcomes = ['pending', 'won', 'lost'] as const;
    if (outcome && !allowedOutcomes.includes(outcome)) {
      return NextResponse.json({ error: 'Invalid outcome. Must be pending, won, or lost' }, { status: 400 });
    }

    const data: any = {};
    if (typeof court_start_date === 'string') data.court_start_date = parseDate(court_start_date);
    if (typeof decision_deadline === 'string') data.decision_deadline = parseDate(decision_deadline);
    if (typeof outcome === 'string') data.outcome = outcome;
    if (typeof progress === 'string') data.progress = progress.trim() || null;
    if (typeof changes === 'string') data.changes = changes.trim() || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    const updateSql = Prisma.sql`
      UPDATE "CaseTrackingHistory"
      SET
        court_start_date    = COALESCE(${data.court_start_date ?? null}, court_start_date),
        decision_deadline   = COALESCE(${data.decision_deadline ?? null}, decision_deadline),
        outcome             = COALESCE(${data.outcome ?? null}::"public"."CaseOutcome", outcome),
        progress            = COALESCE(${data.progress ?? null}, progress),
        changes             = COALESCE(${data.changes ?? null}, changes),
        updated_by_id       = ${decoded.userId},
        updated_at          = NOW()
      WHERE id = ${historyIdNum}
      RETURNING id, case_id, court_start_date, decision_deadline, outcome, progress, changes, updated_by_id, created_at, updated_at
    `;

    const updatedRows = await prisma.$queryRaw<any[]>(updateSql);
    const updated = updatedRows[0];

    // Propagate outcome change to the parent Case so client views reflect updates
    if (typeof data.outcome === 'string') {
      await prisma.case.update({
        where: { id: caseId },
        data: { outcome: data.outcome },
      });
    }

    // If outcome marked as won/lost in history update, generate PDF receipt and email to client
    if (data.outcome === 'won' || data.outcome === 'lost') {
      try {
        const caseInfo = await prisma.case.findUnique({
          where: { id: caseId },
          select: { title: true, client_id: true, lawyer_id: true }
        });
        if (caseInfo) {
          const client = await prisma.user.findUnique({
            where: { id: caseInfo.client_id },
            select: { full_name: true, email: true }
          });
          const lawyer = await prisma.user.findUnique({
            where: { id: caseInfo.lawyer_id },
            select: { full_name: true }
          });

          if (client?.email) {
            const pdfBuffer = await generateCaseOutcomeReceipt({
              caseId,
              caseTitle: caseInfo.title,
              clientFullName: client.full_name || 'Client',
              clientEmail: client.email,
              lawyerName: lawyer?.full_name || 'Lawyer',
              outcome: data.outcome,
              issuedBy: (decoded as any).full_name || 'Admin',
            }, path.join(process.cwd(), 'public', 'ffl-logo.png'));

            const wonHtml = `
              <p>Dear ${client.full_name || 'Client'}, you have successfully won the case <strong>${caseInfo.title}</strong> with the lawyer <strong>${lawyer?.full_name || 'Lawyer'}</strong>. Thank you.</p>
            `;
            const lostHtml = `
              <p>Dear ${client.full_name || 'Client'}, unfortunately the case <strong>${caseInfo.title}</strong> handled by the lawyer <strong>${lawyer?.full_name || 'Lawyer'}</strong> did not succeed. Please contact your lawyer to discuss next steps.</p>
            `;
            const subject = `Case Outcome: ${data.outcome.toUpperCase()} • ${caseInfo.title}`;

            await sendCaseOutcomeReceiptEmail({
              to: client.email,
              subject,
              html: data.outcome === 'won' ? wonHtml : lostHtml,
              pdfBuffer,
              filename: `Case-Outcome-Receipt-${caseInfo.title.replace(/[^a-z0-9\-]+/gi, '_')}-${data.outcome}.pdf`,
            });
          }
        }
      } catch (e) {
        console.warn('Failed to generate/send outcome receipt from history update:', e);
      }
    }

    return NextResponse.json({ success: true, history: updated });
  } catch (error) {
    console.error('Error updating history entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/cases/[id]/tracking/history/[historyId]
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string, historyId: string }> }) {
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

    const { id, historyId } = await context.params;
    const caseId = Number(id);
    const historyIdNum = Number(historyId);
    if (!caseId || Number.isNaN(caseId) || !historyIdNum || Number.isNaN(historyIdNum)) {
      return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
    }

    const existingRows = await prisma.$queryRaw<any[]>(Prisma.sql`SELECT id, case_id FROM "CaseTrackingHistory" WHERE id = ${historyIdNum} LIMIT 1`);
    const existing = existingRows[0];
    if (!existing || existing.case_id !== caseId) {
      return NextResponse.json({ error: 'History entry not found for this case' }, { status: 404 });
    }

    // Enforce: only approved cases can have history deleted
    const parentCase = await prisma.case.findUnique({ where: { id: caseId }, select: { status: true } });
    if (!parentCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (parentCase.status !== 'approved') {
      return NextResponse.json({ error: 'History can only be deleted for approved cases' }, { status: 400 });
    }

    await prisma.$executeRaw(Prisma.sql`DELETE FROM "CaseTrackingHistory" WHERE id = ${historyIdNum}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting history entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}