const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: "file:./data/noticeboard.db" } } });

async function main() {
  const counts = {
    users: await prisma.user.count(),
    notices: await prisma.notice.count(),
    categories: await prisma.category.count(),
    meetings: await prisma.meetingSchedule.count(),
    events: await prisma.specialEvent.count(),
    roles: await prisma.roleAssignment.count(),
    roleTemplates: await prisma.roleTemplate.count(),
    files: await prisma.uploadedFile.count(),
    settings: await prisma.setting.count(),
    bookmarks: await prisma.bookmark.count(),
    locations: await prisma.savedLocation.count(),
    overrides: await prisma.meetingOverride.count(),
    logs: await prisma.actionLog.count(),
  };
  console.log("Current counts:", JSON.stringify(counts, null, 2));

  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true, email: true } });
  console.log("Users:", JSON.stringify(users, null, 2));

  const settings = await prisma.setting.findMany({ select: { key: true, value: true } });
  console.log("Settings:", settings.map(s => `${s.key}=${(s.value || "").substring(0, 60)}`).join("\n  "));

  const notices = await prisma.notice.findMany({ select: { id: true, title: true, fileUrl: true, thumbnailUrl: true }, take: 5 });
  console.log("Sample notices:", JSON.stringify(notices.map(n => ({ title: n.title, fileUrl: n.fileUrl })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
