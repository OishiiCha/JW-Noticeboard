const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // Find duplicate schedule notices (same eventStartDate)
  const notices = await p.notice.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, eventStartDate: true, eventEndDate: true, content: true },
    orderBy: { eventStartDate: "asc" },
  });
  
  const seen = new Map();
  const toDelete = [];
  for (const n of notices) {
    const key = `${n.title}|${n.eventStartDate}`;
    if (seen.has(key)) {
      const prev = seen.get(key);
      // Keep the one with more content, delete the other
      if ((n.content || "").length > (prev.content || "").length) {
        toDelete.push(prev.id);
        seen.set(key, n);
      } else {
        toDelete.push(n.id);
      }
    } else {
      seen.set(key, n);
    }
  }
  
  if (toDelete.length > 0) {
    console.log(`Deleting ${toDelete.length} duplicate(s):`);
    for (const id of toDelete) {
      console.log(`  ${id}`);
      await p.notice.update({ where: { id }, data: { deletedAt: new Date() } });
    }
  } else {
    console.log("No duplicates found");
  }
  
  // List remaining
  const remaining = await p.notice.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, eventStartDate: true, eventEndDate: true },
    orderBy: { eventStartDate: "asc" },
  });
  console.log(`\nRemaining notices (${remaining.length}):`);
  for (const n of remaining) {
    console.log(`  ${n.title} | ${n.eventStartDate} to ${n.eventEndDate}`);
  }
  
  await p.$disconnect();
})();
