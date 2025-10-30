import { createUser, getUserByUsername, getUserByEmail } from '../src/lib/auth';
import prisma from '../src/lib/prisma';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createAdminUser() {
  try {
    console.log('=== Create Admin User ===\n');

    const username = await question('Enter username: ');
    const email = await question('Enter email: ');
    const password = await question('Enter password (min 8 characters): ');
    const fullName = await question('Enter full name: ');
    const contactAddress = await question('Enter contact address (optional): ');

    // Validation
    if (!username || !email || !password || !fullName) {
      console.error('❌ Username, email, password, and full name are required');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters long');
      process.exit(1);
    }


    // Check if user already exists
    const existingUserByUsername = await getUserByUsername(username);
    if (existingUserByUsername) {
      console.error('❌ Username already exists');
      process.exit(1);
    }

    const existingUserByEmail = await getUserByEmail(email);
    if (existingUserByEmail) {
      console.error('❌ Email already exists');
      process.exit(1);
    }

    console.log('\n⏳ Creating admin user...');

    // Create admin user
    const newAdmin = await createUser({
      username,
      email,
      password,
      full_name: fullName,
      role: 'admin',
      contact_address: contactAddress || undefined,
      is_verified: true,
    });

    // Update to set superuser privileges
    const updatedAdmin = await prisma.user.update({
      where: { id: newAdmin.id },
      data: {
        is_superuser: true,
        is_active: true,
      },
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`👤 Username: ${updatedAdmin.username}`);
    console.log(`📧 Email: ${updatedAdmin.email}`);
    console.log(`👑 Role: ${updatedAdmin.role}`);
    console.log(`🔑 Superuser: ${updatedAdmin.is_superuser}`);
    console.log(`✅ Active: ${updatedAdmin.is_active}`);
    console.log(`✅ Verified: ${updatedAdmin.is_verified}`);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createAdminUser();