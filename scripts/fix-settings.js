// Update settings with fake congregation info
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const fakeSettings = {
    congregationTitle: "Talisay City Congregation",
    midweekDay: "2",          // Tuesday
    midweekTime: "18:30",     // 6:30 PM
    weekendDay: "0",          // Sunday
    weekendTime: "10:00",     // 10:00 AM
    calendarStartDay: "1",    // Monday
    meetingLocation: "Kingdom Hall of Jehovah's Witnesses, Talisay City, Cebu",
    mapAddress: "Mabini St, Talisay City, Cebu 6045, Philippines",
    mapLat: "10.2444",
    mapLng: "123.8170",
    mapEmbedUrl: "",
  };

  for (const [key, value] of Object.entries(fakeSettings)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (existing) {
      await prisma.setting.update({ where: { key }, data: { value } });
      console.log(`  Updated ${key} = ${value}`);
    } else {
      await prisma.setting.create({ data: { key, value } });
      console.log(`  Created ${key} = ${value}`);
    }
  }

  // Verify
  const all = await prisma.setting.findMany();
  console.log("\nFinal settings:");
  for (const s of all) {
    console.log(`  ${s.key} = ${s.value}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
