import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByUsername, getUserByEmail } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Check if any admin users already exist
    const existingAdmin = await prisma.user.findFirst({
      where: { 
        OR: [
          { role: 'admin' },
          { is_superuser: true }
        ]
      }
    });

    if (existingAdmin) {
      return NextResponse.json({ 
        error: 'Admin user already exists. This endpoint is only for initial setup.' 
      }, { status: 400 });
    }

    const { username, email, password, full_name } = await request.json();

    // Validation
    if (!username || !email || !password || !full_name) {
      return NextResponse.json({ 
        error: 'Username, email, password, and full name are required' 
      }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ 
        error: 'Password must be at least 8 characters long' 
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUserByUsername = await getUserByUsername(username);
    if (existingUserByUsername) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const existingUserByEmail = await getUserByEmail(email);
    if (existingUserByEmail) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Create first admin user
    const newAdmin = await createUser({
      username,
      email,
      password,
      full_name,
      role: 'admin',
      is_verified: true,
    });

    // Update to superuser
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
      message: 'First admin user created successfully! This endpoint is now disabled.',
      admin: updatedAdmin
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating first admin user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}