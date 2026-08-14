const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.notice.deleteMany({ where: { title: "test" } });
  console.log("Deleted test notices:", r.count);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
