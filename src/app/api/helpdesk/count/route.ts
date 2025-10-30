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
      CREATE TABLE IF NOT EXISTS "HelpTicketRead" (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        last_read_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS help_ticket_read_unique ON "HelpTicketRead" (ticket_id, user_id);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS help_ticket_msg_created_idx ON "HelpTicketMessage" (created_at DESC);
    `);
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureHelpdeskTables();

    const isAdmin = Boolean(decoded.is_superuser || decoded.role === 'admin');
    // Compute unread message count role-aware:
    // - Admin: messages from non-admin senders created after admin's last_read per ticket
    // - Client/Lawyer: messages from admin created after user's last_read per ticket
    const rows: any[] = await prisma.$queryRawUnsafe(
      isAdmin
        ? `SELECT COUNT(*) AS c
           FROM "HelpTicketMessage" m
           JOIN "HelpTicket" t ON t.id = m.ticket_id
           LEFT JOIN "HelpTicketRead" r ON r.ticket_id = t.id AND r.user_id = $1
           WHERE m.sender_role <> 'admin'
             AND m.created_at > COALESCE(r.last_read_at, '1970-01-01')`
        : `SELECT COUNT(*) AS c
           FROM "HelpTicketMessage" m
           JOIN "HelpTicket" t ON t.id = m.ticket_id
           LEFT JOIN "HelpTicketRead" r ON r.ticket_id = t.id AND r.user_id = $1
           WHERE t.created_by = $1
             AND m.sender_role = 'admin'
             AND m.created_at > COALESCE(r.last_read_at, '1970-01-01')`,
      decoded.userId
    );

    const raw = Array.isArray(rows) && rows[0]?.c != null ? rows[0].c : 0;
    const count = typeof raw === 'bigint' ? Number(raw) : Number(raw);
    return NextResponse.json({ count }, { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('Error fetching helpdesk count:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}