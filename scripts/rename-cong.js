const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const updates = {
    congregationTitle: "Cebu City Central Congregation",
    meetingLocation: "Kingdom Hall of Jehovah's Witnesses, Osmena Blvd, Cebu City",
    mapAddress: "Osmena Blvd, Cebu City, 6000 Cebu, Philippines",
    mapLat: "10.3157",
    mapLng: "123.8854",
  };
  for (const [key, value] of Object.entries(updates)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (existing) {
      await prisma.setting.update({ where: { key }, data: { value } });
    } else {
      await prisma.setting.create({ data: { key, value } });
    }
    console.log(`  ${key} = ${value}`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
