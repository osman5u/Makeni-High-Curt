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
  } catch {}
}

// GET /api/helpdesk/tickets/[id]/messages - list messages (admin or owner)
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ticketId = Number(id);
    if (Number.isNaN(ticketId)) return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureHelpdeskTables();

    // Check access
    const ownerRows = await prisma.$queryRawUnsafe(`SELECT created_by FROM "HelpTicket" WHERE id = $1`, ticketId);
    const ownerId = Array.isArray(ownerRows) && ownerRows[0]?.created_by ? Number(ownerRows[0].created_by) : null;
    const isAdmin = Boolean(decoded.is_superuser || decoded.role === 'admin');
    if (!isAdmin && ownerId !== decoded.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

  const messages = await prisma.$queryRawUnsafe(
      `SELECT m.id, m.ticket_id, m.sender_id, m.sender_role, m.content, m.created_at,
              u.full_name AS sender_name
       FROM "HelpTicketMessage" m
       LEFT JOIN "User" u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
    ticketId
  );

    // Mark as read for this user on this ticket (upsert)
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "HelpTicketRead" (ticket_id, user_id, last_read_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (ticket_id, user_id)
         DO UPDATE SET last_read_at = NOW()`,
        ticketId,
        decoded.userId
      );
    } catch {}

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error listing helpdesk messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/helpdesk/tickets/[id]/messages - add a message (admin or owner), optional status update
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ticketId = Number(id);
    if (Number.isNaN(ticketId)) return NextResponse.json({ error: 'Invalid ticket id' }, { status: 400 });

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureHelpdeskTables();

    const ownerRows = await prisma.$queryRawUnsafe(`SELECT created_by FROM "HelpTicket" WHERE id = $1`, ticketId);
    const ownerId = Array.isArray(ownerRows) && ownerRows[0]?.created_by ? Number(ownerRows[0].created_by) : null;
    const isAdmin = Boolean(decoded.is_superuser || decoded.role === 'admin');
    if (!isAdmin && ownerId !== decoded.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const content: string | undefined = body?.content;
    const statusUpdate: string | undefined = body?.status; // optional: 'open' | 'closed'
    if (!content || !content.trim()) return NextResponse.json({ error: 'Message content required' }, { status: 400 });

    await prisma.$queryRawUnsafe(
      `INSERT INTO "HelpTicketMessage" (ticket_id, sender_id, sender_role, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ticketId,
      decoded.userId,
      decoded.role,
      content.trim()
    );

    if (statusUpdate && (statusUpdate === 'open' || statusUpdate === 'closed')) {
      await prisma.$queryRawUnsafe(
        `UPDATE "HelpTicket" SET status = $1, updated_at = NOW() WHERE id = $2`,
        statusUpdate,
        ticketId
      );
    } else {
      await prisma.$queryRawUnsafe(
        `UPDATE "HelpTicket" SET updated_at = NOW() WHERE id = $1`,
        ticketId
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error posting helpdesk message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}