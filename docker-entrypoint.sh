#!/bin/sh
set -e

echo "🚀 Starting Noticeboard App..."

# ─── Fix permissions on bind-mounted directories ────────────
chown -R 1001:1001 /app/data /app/public/uploads 2>/dev/null || true

# ─── Ensure upload directories exist ────────────────────────
mkdir -p /app/public/uploads/notices /app/public/uploads/schedules /app/public/uploads/events /app/public/uploads/roles

# ─── Initialize database ─────────────────────────────────────
echo "📦 Setting up database..."
mkdir -p /app/data

sqlite3 /app/data/noticeboard.db < prisma/init.sql 2>/dev/null || true

# ─── Migrate: add missing columns to existing tables ─────────
# init.sql uses CREATE TABLE IF NOT EXISTS so it won't add columns
# to tables that already exist from older schema versions.
echo "🔧 Running column migrations..."

# Helper: add column if it doesn't exist
migrate_column() {
  local table="$1" column="$2" definition="$3"
  local exists=$(sqlite3 /app/data/noticeboard.db "PRAGMA table_info($table);" 2>/dev/null | grep -c "|$column|")
  if [ "$exists" = "0" ]; then
    sqlite3 /app/data/noticeboard.db "ALTER TABLE $table ADD COLUMN $column $definition;" 2>/dev/null && echo "  ✅ Added $table.$column" || true
  fi
}

migrate_column "Notice" "galleryUrls" "TEXT"
migrate_column "Notice" "isArchived" "BOOLEAN NOT NULL DEFAULT 0"
migrate_column "Notice" "archivedAt" "DATETIME"
migrate_column "Notice" "location" "TEXT"
migrate_column "Notice" "latitude" "REAL"
migrate_column "Notice" "longitude" "REAL"
migrate_column "User" "tempPassword" "TEXT"

# Add isArchived index if missing
sqlite3 /app/data/noticeboard.db "CREATE INDEX IF NOT EXISTS Notice_isArchived_idx ON Notice(isArchived);" 2>/dev/null || true

# ─── Migrate: MeetingOverride unique constraint ─────────────
# Change from date-only unique to composite [date, meetingType] unique
echo "🔧 Migrating MeetingOverride unique constraint..."
# Drop old unique index on date alone (Prisma names it MeetingOverride_date_key)
sqlite3 /app/data/noticeboard.db "DROP INDEX IF EXISTS MeetingOverride_date_key;" 2>/dev/null || true
sqlite3 /app/data/noticeboard.db "DROP INDEX IF EXISTS sqlite_autoindex_MeetingOverride_1;" 2>/dev/null || true
# Create new composite unique index
sqlite3 /app/data/noticeboard.db "CREATE UNIQUE INDEX IF NOT EXISTS MeetingOverride_date_meetingType_key ON MeetingOverride(date, meetingType);" 2>/dev/null || true

# ─── Seed admin user ─────────────────────────────────────────
echo "🌱 Seeding admin user if needed..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  try {
    const existingAdmin = await prisma.user.findFirst({ where: { role: { in: ['admin', 'super_admin'] } } });

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jw.org';
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          name: 'Admin',
          username: 'admin',
          email: adminEmail,
          password: hashedPassword,
          role: 'super_admin',
          isActive: true,
        },
      });
      console.log('✅ Admin user created: ' + adminEmail);
    } else {
      updates = { password: hashedPassword, isActive: true };
      if (!existingAdmin.username) updates.username = 'admin';
      if (!existingAdmin.email) updates.email = adminEmail;
      await prisma.user.update({ where: { id: existingAdmin.id }, data: updates });
      console.log('✅ Admin user repaired');
    }

    // Seed default categories
    const categoryCount = await prisma.category.count();
    if (categoryCount === 0) {
      const defaults = [
        { name: 'Announcements', nameTl: 'Mga Anunsyo', slug: 'announcements', icon: 'megaphone', color: 'bg-blue-500', sortOrder: 0 },
        { name: 'Meetings', nameTl: 'Mga Pulong', slug: 'meetings', icon: 'calendar', color: 'bg-green-500', sortOrder: 1 },
        { name: 'Events', nameTl: 'Mga Kaganapan', slug: 'events', icon: 'calendar-days', color: 'bg-purple-500', sortOrder: 2 },
        { name: 'Ministry', nameTl: 'Ministeryo', slug: 'ministry', icon: 'book-open', color: 'bg-amber-500', sortOrder: 3 },
        { name: 'Documents', nameTl: 'Mga Dokumento', slug: 'documents', icon: 'file-text', color: 'bg-gray-500', sortOrder: 4 },
      ];
      for (const cat of defaults) {
        await prisma.category.create({ data: cat });
      }
      console.log('✅ Default categories created');
    }

    console.log('🎉 Database ready!');
  } catch (error) {
    console.error('⚠️  Seed error (non-fatal):', error.message);
  } finally {
    await prisma.\$disconnect();
  }
}

seed();
" 2>&1 || echo "⚠️  Seed script failed (non-fatal)"

chown -R 1001:1001 /app/data /app/public/uploads 2>/dev/null || true

# ─── Start daily backup cron ─────────────────────────────────
echo "⏰ Starting daily backup cron..."
mkdir -p /app/data/backups
chown -R 1001:1001 /app/data/backups 2>/dev/null || true
echo "0 2 * * * /app/scripts/backup.sh >> /app/data/backups/cron.log 2>&1" | crontab -
crond -b -L /app/data/backups/cron.log

# ─── Start the server ────────────────────────────────────────
echo "🎉 Starting server..."
exec su-exec nextjs node server.js
