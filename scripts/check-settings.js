const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const settings = await prisma.setting.findMany();
  console.log("Current settings:");
  for (const s of settings) {
    console.log(`  ${s.key} = ${s.value}`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
