import { NextRequest, NextResponse } from 'next/server';
import { generateTokens, verifyToken, getUserById } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const refresh: string | undefined = body?.refresh;
        if (!refresh || typeof refresh !== 'string') {
            return NextResponse.json({ error: 'Refresh token is required' }, { status: 400 });
        }

        const decoded = verifyToken(refresh);
        if (!decoded || !decoded.userId) {
            return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
        }

        const user = await getUserById(decoded.userId);
        if (!user || user.isActive === false) {
            return NextResponse.json({ error: 'User not found or inactive' }, { status: 404 });
        }

        const tokens = generateTokens(user as any);
        return NextResponse.json({ access: tokens.access, refresh: tokens.refresh }, { status: 200 });
    } catch (error) {
        console.error('[POST /api/auth/refresh]', error);
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 500 });
    }
}