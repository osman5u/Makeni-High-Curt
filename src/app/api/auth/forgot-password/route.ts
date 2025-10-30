import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, updateUserResetToken } from '@/lib/auth';
import { generateResetToken, sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Update user with reset token
    const updated = await updateUserResetToken(user.id, resetToken, resetExpires);
    if (!updated) {
      return NextResponse.json({ 
        error: 'Failed to generate reset token' 
      }, { status: 500 });
    }

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(email, resetToken, user.full_name);
    
    if (!emailSent) {
      console.error('Failed to send password reset email');
      return NextResponse.json({ 
        error: 'Failed to send reset email' 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
