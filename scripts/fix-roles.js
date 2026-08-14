// Fix role assignments — should only be A/V and Security roles, not meeting parts
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  // Delete all existing role assignments
  const deleted = await prisma.roleAssignment.deleteMany({});
  console.log(`Deleted ${deleted.count} old role assignments`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonday = addDays(today, -(today.getDay() || 7) + 1);
  const nextMonday = addDays(thisMonday, 7);
  const lastMonday = addDays(thisMonday, -7);

  // A/V and Security roles only — these are the support assignments, not the meeting parts
  const avSecurityRoles = {
    current: `Sound: M. Johnson
Microphones: A. Reyes
Stage: C. Cruz
Audio/Video: R. Davis
Security: J. Smith
Attendant: P. Garcia
Attendant: L. Tan`,
    next: `Sound: P. Garcia
Microphones: J. Smith
Stage: L. Tan
Audio/Video: M. Johnson
Security: A. Reyes
Attendant: R. Davis
Attendant: C. Cruz`,
    last: `Sound: R. Davis
Microphones: L. Tan
Stage: J. Smith
Audio/Video: P. Garcia
Security: M. Johnson
Attendant: A. Reyes
Attendant: C. Cruz`,
  };

  // Create role assignments for A/V and Security only
  const rolesToCreate = [
    { weekDate: lastMonday, label: "Week of " + lastMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" }), ocrText: avSecurityRoles.last },
    { weekDate: thisMonday, label: "Week of " + thisMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" }), ocrText: avSecurityRoles.current },
    { weekDate: nextMonday, label: "Week of " + nextMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" }), ocrText: avSecurityRoles.next },
  ];

  for (const r of rolesToCreate) {
    // Midweek A/V + Security
    await prisma.roleAssignment.create({
      data: {
        title: `A/V & Security — Midweek — ${r.label}`,
        meetingType: "midweek",
        weekDate: toYMD(r.weekDate),
        ocrText: r.ocrText,
        ocrStatus: "done",
        isPublished: true,
        showOnNoticeboard: true,
      },
    });
    console.log(`  Created A/V & Security (midweek) — ${r.label}`);

    // Weekend A/V + Security
    await prisma.roleAssignment.create({
      data: {
        title: `A/V & Security — Weekend — ${r.label}`,
        meetingType: "weekend",
        weekDate: toYMD(r.weekDate),
        ocrText: r.ocrText,
        ocrStatus: "done",
        isPublished: true,
        showOnNoticeboard: true,
      },
    });
    console.log(`  Created A/V & Security (weekend) — ${r.label}`);
  }

  // Verify
  const count = await prisma.roleAssignment.count();
  console.log(`\nTotal role assignments now: ${count}`);
  const all = await prisma.roleAssignment.findMany({ orderBy: { weekDate: "asc" } });
  for (const r of all) {
    console.log(`  - ${r.title}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
