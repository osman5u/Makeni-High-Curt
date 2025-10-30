import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import seed from '@/lib/prisma-seed-runner'; // helper to invoke prisma/seed.ts

export async function POST() {
  try {
    await seed();
    return NextResponse.json({ message: 'Database seeded successfully!' });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database' },
      { status: 500 }
    );
  }
}
