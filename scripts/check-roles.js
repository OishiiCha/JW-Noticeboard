const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const roles = await prisma.roleAssignment.findMany();
  console.log("Current roles:");
  for (const r of roles) {
    console.log(`  - ${r.title} (${r.meetingType})`);
    console.log(`    ocrText: ${r.ocrText}`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
