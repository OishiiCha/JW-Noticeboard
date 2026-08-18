const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const currentYear = new Date().getFullYear();
  const notices = await p.notice.findMany({
    where: { deletedAt: null, eventStartDate: { startsWith: "2020-" } },
    select: { id: true, title: true, eventStartDate: true, eventEndDate: true },
  });
  console.log(`Found ${notices.length} notices with year 2020 — fixing to ${currentYear}`);
  for (const n of notices) {
    const newStart = n.eventStartDate ? `${currentYear}${n.eventStartDate.substring(4)}` : n.eventStartDate;
    const newEnd = n.eventEndDate ? `${currentYear}${n.eventEndDate.substring(4)}` : n.eventEndDate;
    console.log(`  ${n.title}: ${n.eventStartDate} -> ${newStart}`);
    await p.notice.update({ where: { id: n.id }, data: { eventStartDate: newStart, eventEndDate: newEnd } });
  }
  console.log("Done");
  await p.$disconnect();
})();
