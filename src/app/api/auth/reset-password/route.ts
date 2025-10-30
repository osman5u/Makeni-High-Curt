import { NextRequest, NextResponse } from 'next/server';
import { getUserByResetToken, updateUserPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ 
        error: 'Reset token and new password are required' 
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        error: 'Password must be at least 6 characters long'
      }, { status: 400 });
    }

    // Find user by reset token
    const user = await getUserByResetToken(token);
    if (!user) {
      return NextResponse.json({ 
        error: 'Invalid or expired reset token' 
      }, { status: 400 });
    }

    // Update user password
    const updated = await updateUserPassword(user.id, password);
    if (!updated) {
      return NextResponse.json({ 
        error: 'Failed to reset password' 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
