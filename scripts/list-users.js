const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true, email: true, role: true } });
  console.log("Users:");
  for (const u of users) {
    console.log(`  ${u.username} | ${u.email} | ${u.role}`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
