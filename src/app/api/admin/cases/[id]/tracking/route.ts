import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { wsEmit } from '@/lib/websocket';
import { Prisma } from '@prisma/client';
import { generateCaseOutcomeReceipt } from '@/lib/pdf-receipt';
import { sendCaseOutcomeReceiptEmail } from '@/lib/email';
import path from 'path';

export const runtime = 'nodejs';

// PATCH /api/admin/cases/[id]/tracking
// Body: { court_start_date?: string, decision_deadline?: string, outcome?: 'pending' | 'won' | 'lost', progress?: string }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    const body = await request.json();
    const { court_start_date, decision_deadline, outcome, progress } = body || {};

    const allowedOutcomes = ['pending', 'won', 'lost'] as const;
    if (outcome && !allowedOutcomes.includes(outcome)) {
      return NextResponse.json({ error: 'Invalid outcome. Must be pending, won, or lost' }, { status: 400 });
    }

    const existing = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, title: true, status: true, client_id: true, lawyer_id: true }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Only allow tracking updates for approved cases
    if (existing.status !== 'approved') {
      return NextResponse.json({ error: 'Tracking can only be updated on approved cases' }, { status: 400 });
    }

    const data: any = {};
    const changes: string[] = [];

    if (typeof court_start_date === 'string' && court_start_date.trim()) {
      const d = new Date(court_start_date);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid court_start_date' }, { status: 400 });
      }
      data.court_start_date = d;
      changes.push(`court start date set to ${d.toDateString()}`);
    }

    if (typeof decision_deadline === 'string' && decision_deadline.trim()) {
      const d = new Date(decision_deadline);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid decision_deadline' }, { status: 400 });
      }
      data.decision_deadline = d;
      changes.push(`decision deadline set to ${d.toDateString()}`);
    }

    if (typeof outcome === 'string') {
      data.outcome = outcome;
      changes.push(`outcome updated to ${outcome.toUpperCase()}`);
    }

    if (typeof progress === 'string') {
      const trimmed = progress.trim();
      data.progress = trimmed.length ? trimmed : null;
      if (trimmed.length) changes.push('progress updated');
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    const updated = await prisma.case.update({
      where: { id: caseId },
      data
    });

    // Log tracking history snapshot (raw SQL so it works without regenerated client)
    try {
      await prisma.$executeRaw(
        Prisma.sql`INSERT INTO "CaseTrackingHistory" ("case_id","updated_by_id","court_start_date","decision_deadline","outcome","progress","changes") VALUES (${caseId}, ${decoded.userId}, ${data.court_start_date ?? null}, ${data.decision_deadline ?? null}, ${data.outcome ? Prisma.sql`${data.outcome}::"public"."CaseOutcome"` : Prisma.sql`NULL`}, ${typeof data.progress === 'string' ? data.progress : null}, ${changes.length ? changes.join(', ') : null})`
      );
    } catch (e) {
      console.warn('Failed to log case tracking history:', e);
    }

    // Notify client and lawyer about updates
    const recipients = [existing.client_id, existing.lawyer_id].filter(Boolean) as number[];
    const message = changes.length
      ? `Case "${existing.title}" tracking updated: ${changes.join(', ')}`
      : `Case "${existing.title}" tracking updated.`;

    await Promise.all(
      recipients.map(async (rid) => {
        const notif = await prisma.notification.create({
          data: {
            case_id: caseId,
            message,
            recipient_id: rid,
            sender_id: decoded.userId,
          },
        });
        // Emit realtime notification and updated count
        wsEmit(`private-notifications-user-${rid}`, 'notification-created', {
          id: notif.id,
          case_id: caseId,
          message,
          read: notif.read,
          recipient_id: rid,
          sender_id: decoded.userId,
          created_at: notif.created_at,
          updated_at: notif.updated_at,
          case_title: existing.title,
          sender_name: (decoded as any).full_name || 'Admin',
        });
        const unreadCount = await prisma.notification.count({ where: { recipient_id: rid, read: false } });
        wsEmit(`private-notifications-user-${rid}`, 'notification-count', { count: unreadCount });
      })
    );

    // If outcome marked as won/lost, generate PDF receipt and email to client
    if (data.outcome === 'won' || data.outcome === 'lost') {
      try {
        const client = await prisma.user.findUnique({
          where: { id: existing.client_id! },
          select: { full_name: true, email: true }
        });
        const lawyer = await prisma.user.findUnique({
          where: { id: existing.lawyer_id! },
          select: { full_name: true }
        });

        if (client?.email) {
          const pdfBuffer = await generateCaseOutcomeReceipt({
            caseId,
            caseTitle: existing.title,
            clientFullName: client.full_name || 'Client',
            clientEmail: client.email,
            lawyerName: lawyer?.full_name || 'Lawyer',
            outcome: data.outcome,
            issuedBy: (decoded as any).full_name || 'Admin',
          }, path.join(process.cwd(), 'public', 'ffl-logo.png'));

          const wonHtml = `
            <p>Dear ${client.full_name || 'Client'}, you have successfully won the case <strong>${existing.title}</strong> with the lawyer <strong>${lawyer?.full_name || 'Lawyer'}</strong>. Thank you.</p>
          `;
          const lostHtml = `
            <p>Dear ${client.full_name || 'Client'}, unfortunately the case <strong>${existing.title}</strong> handled by the lawyer <strong>${lawyer?.full_name || 'Lawyer'}</strong> did not succeed. Please contact your lawyer to discuss next steps.</p>
          `;
          const subject = `Case Outcome: ${data.outcome.toUpperCase()} • ${existing.title}`;

          await sendCaseOutcomeReceiptEmail({
            to: client.email,
            subject,
            html: data.outcome === 'won' ? wonHtml : lostHtml,
            pdfBuffer,
            filename: `Case-Outcome-Receipt-${existing.title.replace(/[^a-z0-9\-]+/gi, '_')}-${data.outcome}.pdf`,
          });
        }
      } catch (e) {
        console.warn('Failed to generate/send outcome receipt:', e);
      }
    }

    return NextResponse.json({ success: true, case: updated });
  } catch (error) {
    console.error('Error updating case tracking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}