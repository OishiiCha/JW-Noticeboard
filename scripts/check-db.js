const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const notices = await prisma.notice.count();
  const categories = await prisma.category.count();
  const events = await prisma.specialEvent.count();
  const roles = await prisma.roleAssignment.count();
  const meetings = await prisma.meetingSchedule.count();
  const users = await prisma.user.count();
  console.log({ notices, categories, events, roles, meetings, users });
  const cats = await prisma.category.findMany();
  console.log("Categories:", cats.map(c => c.name));
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
