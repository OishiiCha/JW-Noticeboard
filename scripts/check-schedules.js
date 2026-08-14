const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const notices = await prisma.notice.findMany({
    where: { category: { name: "Meetings" } },
    include: { category: true },
    orderBy: { eventStartDate: "asc" },
  });
  for (const n of notices) {
    console.log(`\n=== ${n.title} ===`);
    console.log(n.content || "(no content)");
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
