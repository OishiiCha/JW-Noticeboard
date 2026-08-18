const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const notices = await p.notice.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, eventStartDate: true, eventEndDate: true, isPublished: true, showOnCalendar: true, content: true, fileUrl: true },
    orderBy: { eventStartDate: "asc" },
  });
  const today = new Date().toISOString().split("T")[0];
  console.log("Today:", today);
  console.log("Total notices:", notices.length);
  for (const n of notices) {
    const isSchedule = n.title.toLowerCase().includes("midweek") || n.title.toLowerCase().includes("public talk") || n.title.toLowerCase().includes("schedule");
    if (isSchedule) {
      const end = n.eventEndDate || n.eventStartDate || "";
      const isPast = end < today;
      console.log(`\n${isPast ? "PAST" : "UPCOMING"} | showCal=${n.showOnCalendar} published=${n.isPublished}`);
      console.log(`  title: ${n.title}`);
      console.log(`  start=${n.eventStartDate} end=${n.eventEndDate}`);
      console.log(`  fileUrl=${n.fileUrl}`);
      console.log(`  content (first 200): ${(n.content || "").substring(0, 200)}`);
    }
  }
  await p.$disconnect();
})();
