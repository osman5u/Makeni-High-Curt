import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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

    // Ensure table exists (defensive)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "LoginAttempt" (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255),
          user_id INTEGER NULL,
          status VARCHAR(16) NOT NULL,
          reason VARCHAR(32) NULL,
          ip VARCHAR(64) NULL,
          user_agent TEXT NULL,
          location TEXT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
    } catch {}

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const statusParam = url.searchParams.get('status'); // optional: success|failure
    const usernameParam = url.searchParams.get('username');

    let limit = 100;
    if (limitParam) {
      const p = parseInt(limitParam, 10);
      if (!Number.isNaN(p) && p > 0) limit = Math.min(p, 500);
    }

    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (statusParam === 'success' || statusParam === 'failure') {
      clauses.push(`status = $${idx++}`);
      params.push(statusParam);
    }
    if (usernameParam && usernameParam.trim()) {
      clauses.push(`username ILIKE $${idx++}`);
      params.push(`%${usernameParam.trim()}%`);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, username, user_id, status, reason, ip, user_agent, location, created_at
       FROM "LoginAttempt"
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      ...params
    );

    return NextResponse.json({ attempts: rows }, { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('Error fetching login attempts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}