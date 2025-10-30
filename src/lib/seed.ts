import { createUser } from './auth';
import db from './database';

export const seedDatabase = async () => {
  try {
    console.log('Seeding database...');

    // Check if users already exist
    const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    
    if (existingUsers.count > 0) {
      console.log('Database already seeded, skipping...');
      return;
    }

    // Create admin user
    const admin = await createUser({
      username: 'admin',
      email: 'admin@legalsystem.com',
      password: 'admin123',
      full_name: 'System Administrator',
      role: 'admin'
    });

    // Update admin to be superuser
    db.prepare('UPDATE users SET is_superuser = 1 WHERE id = ?').run(admin.id);

    // Create lawyer user
    const lawyer = await createUser({
      username: 'lawyer1',
      email: 'lawyer@legalsystem.com',
      password: 'lawyer123',
      full_name: 'John Smith',
      role: 'lawyer'
    });

    // Create client user
    const client = await createUser({
      username: 'client1',
      email: 'client@legalsystem.com',
      password: 'client123',
      full_name: 'Jane Doe',
      role: 'client'
    });

    // Create a sample case
    const caseStmt = db.prepare(`
      INSERT INTO cases (title, description, client_id, lawyer_id, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const caseResult = caseStmt.run(
      'Contract Dispute',
      'Client is seeking legal advice regarding a contract dispute with their business partner.',
      client.id,
      lawyer.id,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      'pending'
    );

    // Create a sample notification
    const notificationStmt = db.prepare(`
      INSERT INTO notifications (case_id, message, recipient_id, sender_id)
      VALUES (?, ?, ?, ?)
    `);
    
    notificationStmt.run(
      caseResult.lastInsertRowid,
      'A new case "Contract Dispute" has been filed.',
      lawyer.id,
      client.id
    );

    console.log('Database seeded successfully!');
    console.log('Created users:');
    console.log('- Admin: admin / admin123');
    console.log('- Lawyer: lawyer1 / lawyer123');
    console.log('- Client: client1 / client123');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};
