import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error('DIRECT_URL or DATABASE_URL must be set in .env for seeding.');
}
if (datasourceUrl.startsWith('prisma+')) {
  throw new Error('DIRECT_URL must be a normal Postgres URL (not prisma+). Set DIRECT_URL to your database for seeding.');
}

const prisma = new PrismaClient({
  datasourceUrl,
});

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  // Admin
  const admin = await prisma.user.create({
    data: {
      username: 'admin2',
      email: 'admin2@legalsystem.com',
      password: await hash('admin123', 12),
      full_name: 'System Administrator',
      role: 'admin',
      is_superuser: true,
      is_verified: true,
      is_active: true,
    },
  });
  console.log('Seeded admin user:', admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

