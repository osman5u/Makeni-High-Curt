import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createUser, getUserByUsername, getUserByEmail } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('access_token')?.value;
    
    // Check if user is authenticated and is a superuser
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user || !user.is_superuser) {
      return NextResponse.json({ error: 'Only superusers can create admin accounts' }, { status: 403 });
    }

    const { username, email, password, full_name, contact_address, profile_picture } = await request.json();

    // Validation
    if (!username || !email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Username, email, password, and full_name are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
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

    // Create admin user
    const newAdmin = await createUser({
      username,
      email,
      password,
      full_name,
      role: 'admin',
      contact_address,
      profile_picture,
      is_verified: true, // Admin users are automatically verified
    });

    // Update the user to be a superuser (since createUser doesn't handle this)
    const prisma = (await import('@/lib/prisma')).default;
    const updatedAdmin = await prisma.user.update({
      where: { id: newAdmin.id },
      data: { 
        is_superuser: true,
        is_active: true 
      },
      select: {
        id: true,
        username: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        is_superuser: true,
        is_verified: true,
        created_at: true,
      },
    });

    return NextResponse.json({
      message: 'Admin user created successfully',
      admin: updatedAdmin
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}