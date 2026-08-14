const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  console.log("=== Users ===");
  const users = await prisma.user.findMany();
  for (const u of users) {
    console.log(`  ${u.username} (admin: ${u.isAdmin})`);
  }

  console.log("\n=== Categories ===");
  const cats = await prisma.category.findMany();
  for (const c of cats) {
    console.log(`  ${c.name} (id: ${c.id})`);
  }

  console.log("\n=== Special Events ===");
  const events = await prisma.specialEvent.findMany();
  for (const e of events) {
    console.log(`  ${e.title} | ${e.location} | ${e.startDate}`);
  }

  console.log("\n=== Role Assignments ===");
  const roles = await prisma.roleAssignment.findMany();
  for (const r of roles) {
    console.log(`  ${r.title} (${r.meetingType})`);
  }

  console.log("\n=== Notices (titles) ===");
  const notices = await prisma.notice.findMany({ select: { title: true, location: true } });
  for (const n of notices) {
    console.log(`  ${n.title} ${n.location ? "| " + n.location : ""}`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
