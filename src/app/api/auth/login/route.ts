import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateTokens } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function ensureLoginAttemptTable() {
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
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS login_attempt_created_at_idx ON "LoginAttempt" (created_at DESC);
    `);
  } catch (e) {
    // swallow errors; logging should not break login
  }
}

async function logAttempt(entry: {
  username: string | null;
  userId?: number | null;
  status: 'success' | 'failure';
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  location?: string | null;
}) {
  try {
    await ensureLoginAttemptTable();
    const { username, userId, status, reason, ip, userAgent, location } = entry;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "LoginAttempt" (username, user_id, status, reason, ip, user_agent, location, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      username ?? null,
      userId ?? null,
      status,
      reason ?? null,
      ip ?? null,
      userAgent ?? null,
      location ?? null,
    );
  } catch (e) {
    // ignore
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const ipHeader = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const ip = ipHeader ? String(ipHeader).split(',')[0].trim() : null;
    const userAgent = request.headers.get('user-agent') || null;
    const location = ip && (ip.includes('127.0.0.1') || ip.includes('::1')) ? 'Localhost' : null;

    if (!username || !password) {
      await logAttempt({ username: username ?? null, status: 'failure', reason: 'bad_request', ip, userAgent, location });
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = await authenticateUser(username, password);
    if (!user) {
      await logAttempt({ username, status: 'failure', reason: 'invalid_credentials', ip, userAgent, location });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      await logAttempt({ username, userId: user.id, status: 'failure', reason: 'inactive', ip, userAgent, location });
      return NextResponse.json(
        { error: 'Account is not active' },
        { status: 401 }
      );
    }

    if (!user.is_verified) {
      await logAttempt({ username, userId: user.id, status: 'failure', reason: 'unverified', ip, userAgent, location });
      return NextResponse.json(
        { error: 'Please verify your email address before logging in. Check your email for a verification link.' },
        { status: 401 }
      );
    }

    const tokens = generateTokens(user);
    await logAttempt({ username, userId: user.id, status: 'success', reason: 'ok', ip, userAgent, location });

    return NextResponse.json({
      access: tokens.access,
      refresh: tokens.refresh,
      role: user.role,
      is_superuser: user.is_superuser,
      full_name: user.full_name,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        profile_picture: user.profile_picture,
        is_lawyer: user.is_lawyer,
        is_active: user.is_active,
        is_superuser: user.is_superuser,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
