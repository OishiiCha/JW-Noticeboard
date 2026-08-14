const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: "file:./data/noticeboard.db" } } });

async function main() {
  console.log("Fresh start: clearing ALL test data...\n");

  // Delete everything except users and settings
  const deleted = {
    bookmarks: await prisma.bookmark.deleteMany({}),
    noticeReads: await prisma.noticeRead.deleteMany({}),
    actionLogs: await prisma.actionLog.deleteMany({}),
    backupLogs: await prisma.backupLog.deleteMany({}),
    notices: await prisma.notice.deleteMany({}),
    roles: await prisma.roleAssignment.deleteMany({}),
    roleTemplates: await prisma.roleTemplate.deleteMany({}),
    meetings: await prisma.meetingSchedule.deleteMany({}),
    overrides: await prisma.meetingOverride.deleteMany({}),
    events: await prisma.specialEvent.deleteMany({}),
    locations: await prisma.savedLocation.deleteMany({}),
    files: await prisma.uploadedFile.deleteMany({}),
    categories: await prisma.category.deleteMany({}),
  };

  for (const [key, result] of Object.entries(deleted)) {
    console.log(`  ${key}: ${result.count} deleted`);
  }

  // Verify what remains
  const remaining = {
    users: await prisma.user.count(),
    settings: await prisma.setting.count(),
  };
  console.log(`\nRemaining: ${remaining.users} user(s), ${remaining.settings} settings`);

  // Clear upload directories
  const fs = require("fs");
  const path = require("path");
  const uploadDirs = ["uploads/notices", "uploads/events", "uploads/roles", "uploads/schedules", "public/uploads/notices", "public/uploads/events", "public/uploads/schedules"];
  for (const dir of uploadDirs) {
    const full = path.join(__dirname, "..", dir);
    if (fs.existsSync(full)) {
      const files = fs.readdirSync(full);
      for (const f of files) fs.unlinkSync(path.join(full, f));
      console.log(`  Cleared ${dir}/ (${files.length} files)`);
    }
  }

  console.log("\nDone! Fresh start ready. Only admin user + settings remain.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
