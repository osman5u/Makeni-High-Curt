import { NextRequest, NextResponse } from 'next/server';
import { getUserByVerificationToken, updateUserVerification } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 });
    }

    // Find user by verification token
    const user = await getUserByVerificationToken(token);
    if (!user) {
      return NextResponse.json({ 
        error: 'Invalid or expired verification token' 
      }, { status: 400 });
    }

    // Update user verification status
    const updated = await updateUserVerification(user.id, true);
    if (!updated) {
      return NextResponse.json({ 
        error: 'Failed to verify account' 
      }, { status: 500 });
    }

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.full_name, user.role);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // Don't fail the verification if email fails
    }

    return NextResponse.json({
      message: 'Email verified successfully! Your account is now active.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_verified: true
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
