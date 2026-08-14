const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const notices = await prisma.notice.findMany({ where: { deletedAt: null, isArchived: false }, select: { title: true, type: true, isPinned: true } });
  console.log("Notices on the board:");
  for (const n of notices) {
    console.log(`  [${n.type}] ${n.isPinned ? "PIN " : ""}${n.title}`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
