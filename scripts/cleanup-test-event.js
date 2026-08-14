const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.specialEvent.deleteMany({ where: { title: "test" } });
  console.log("Deleted test events:", r.count);
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
