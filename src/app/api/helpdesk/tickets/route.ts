import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

async function ensureHelpdeskTables() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HelpTicket" (
        id SERIAL PRIMARY KEY,
        subject TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_role VARCHAR(16) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HelpTicketMessage" (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        sender_role VARCHAR(16) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS help_ticket_updated_idx ON "HelpTicket" (updated_at DESC);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS help_ticket_msg_created_idx ON "HelpTicketMessage" (created_at DESC);
    `);
  } catch {}
}

// GET /api/helpdesk/tickets - list tickets (admin: all; client/lawyer: own)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureHelpdeskTables();

    const isAdmin = Boolean(decoded.is_superuser || decoded.role === 'admin');
    const whereSql = isAdmin ? '' : 'WHERE t.created_by = $1';
    const params: any[] = isAdmin ? [] : [decoded.userId];

    const rows = await prisma.$queryRawUnsafe(
      `SELECT t.id, t.subject, t.created_by, t.created_role, t.status, t.created_at, t.updated_at,
              u.full_name AS created_name,
              (SELECT content FROM "HelpTicketMessage" m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM "HelpTicketMessage" m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
       FROM "HelpTicket" t
       LEFT JOIN "User" u ON u.id = t.created_by
       ${whereSql}
       ORDER BY t.updated_at DESC
       LIMIT 200`,
      ...params
    );

    return NextResponse.json({ tickets: rows }, { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('Error listing helpdesk tickets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/helpdesk/tickets - create a new ticket with initial message
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureHelpdeskTables();

    const body = await request.json().catch(() => ({}));
    const subject: string | undefined = body?.subject;
    const message: string | undefined = body?.message;
    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    const inserted = await prisma.$queryRawUnsafe(
      `INSERT INTO "HelpTicket" (subject, created_by, created_role, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'open', NOW(), NOW()) RETURNING id`,
      subject,
      decoded.userId,
      decoded.role
    );

    const ticketId = Array.isArray(inserted) && inserted[0]?.id ? Number(inserted[0].id) : null;
    if (!ticketId) {
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
    }

    await prisma.$queryRawUnsafe(
      `INSERT INTO "HelpTicketMessage" (ticket_id, sender_id, sender_role, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ticketId,
      decoded.userId,
      decoded.role,
      message
    );

    return NextResponse.json({ id: ticketId });
  } catch (error) {
    console.error('Error creating helpdesk ticket:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}