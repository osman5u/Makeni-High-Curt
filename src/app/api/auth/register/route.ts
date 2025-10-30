import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByUsername, getUserByEmail } from '@/lib/auth';
import { generateVerificationToken, sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { username, email, password, full_name, role, contact_address, profile_picture } = await request.json();

    // Validation
    if (!username || !email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (!['client', 'lawyer', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUserByUsername = await getUserByUsername(username);
    if (existingUserByUsername) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    const existingUserByEmail = await getUserByEmail(email);
    if (existingUserByEmail) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Create user
    const user = await createUser({
      username,
      email,
      password,
      full_name,
      role: role as 'client' | 'lawyer' | 'admin',
      contact_address,
      profile_picture,
      verification_token: verificationToken,
      verification_token_expires: verificationExpires
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(email, verificationToken, full_name);
    
    if (!emailSent) {
      console.error('Failed to send verification email');
      // Still return success but log the error
    }

    return NextResponse.json({
      message: 'User created successfully. Please check your email to verify your account.',
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
        is_verified: user.is_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      emailSent
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
