// Seed fake data directly via Prisma — no auth needed
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");

const prisma = new PrismaClient();
const IMG_DIR = "/tmp/fake-images";

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function fmtRange(start, end) {
  const s = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

async function uploadFile(fileName, folder) {
  const filePath = path.join(IMG_DIR, fileName);
  const buffer = fs.readFileSync(filePath);
  const ext = fileName.split(".").pop();
  const timestamp = Date.now();
  const uuid = randomUUID().split("-")[0];
  const safeBase = fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
  const storedName = `${timestamp}-${uuid}-${safeBase}.${ext}`;
  const mimeType = ext === "png" ? "image/png" : "application/octet-stream";

  const uploaded = await prisma.uploadedFile.create({
    data: {
      originalName: fileName,
      storedName,
      mimeType,
      size: buffer.length,
      folder,
      data: new Uint8Array(buffer),
    },
  });
  return { url: `/api/files/${uploaded.id}`, fileName, fileId: uploaded.id };
}

async function main() {
  console.log("Fetching categories...");
  const categories = await prisma.category.findMany();
  const catMap = {};
  for (const c of categories) catMap[c.name] = c.id;
  console.log("Categories:", Object.keys(catMap));

  // ─── Upload images ───
  console.log("Uploading images...");
  const uploads = {};
  const imageFiles = [
    { name: "schedule_midweek_1.png", folder: "schedules" },
    { name: "schedule_midweek_2.png", folder: "schedules" },
    { name: "schedule_weekend_1.png", folder: "schedules" },
    { name: "event_picnic.png", folder: "events" },
    { name: "event_convention.png", folder: "events" },
    { name: "event_memorial.png", folder: "events" },
    { name: "event_assembly.png", folder: "events" },
    { name: "notice_cleanup.png", folder: "notices" },
    { name: "notice_ministry.png", folder: "notices" },
    { name: "notice_sign.png", folder: "notices" },
  ];
  for (const f of imageFiles) {
    console.log(`  Uploading ${f.name}...`);
    uploads[f.name] = await uploadFile(f.name, f.folder);
    console.log(`    -> ${uploads[f.name].url}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ─── Meeting Schedule Notices ───
  console.log("Creating meeting schedule notices...");

  const thisMonday = addDays(today, -(today.getDay() || 7) + 1);
  const thisSunday = addDays(thisMonday, 6);
  const nextMonday = addDays(thisMonday, 7);
  const nextSunday = addDays(nextMonday, 6);
  const lastMonday = addDays(thisMonday, -7);
  const lastSunday = addDays(lastMonday, 6);

  const midweekContent1 = `Tuesday 6:30 PM
Opening Song: 25 — Prayer: J. Smith
Chairman: R. Davis
Treasures Talk: M. Johnson (15 min)
Spiritual Gems: R. Davis (10 min)
Bible Reading: P. Garcia (4 min)
Song: 48
Apply Yourself: M. Brown (15 min)
  Student 1: A. Reyes (Talk)
  Student 2: C. Cruz (Demo)
Living as Christians: R. Davis (15 min)
  Talk: Faithful in All Things
  Congregation Bible Study: Ch. 12
Song: 102 — Prayer: M. Johnson`;

  const midweekContent2 = `Tuesday 6:30 PM
Opening Song: 34 — Prayer: R. Davis
Chairman: M. Johnson
Treasures Talk: P. Garcia (15 min)
Spiritual Gems: A. Reyes (10 min)
Bible Reading: C. Cruz (4 min)
Song: 91
Apply Yourself: M. Brown (15 min)
  Student 1: J. Smith (Talk)
  Student 2: L. Tan (Demo)
Living as Christians: M. Johnson (15 min)
  Talk: Be Courageous
  Congregation Bible Study: Ch. 13
Song: 144 — Prayer: P. Garcia`;

  const weekendContent1 = `Sunday 10:00 AM — Kingdom Hall
Public Talk: A. Martinez
  Subject: Maintaining Faith in Trials
Watchtower Study: R. Davis
  Article: w26.08 pp. 8-12
Song: 56 — Prayer: M. Johnson`;

  // Last week (past)
  await prisma.notice.create({
    data: {
      title: `Midweek Meeting Schedule — ${fmtRange(lastMonday, lastSunday)}`,
      description: `Midweek meeting schedule for ${fmtRange(lastMonday, lastSunday)}\n\n${midweekContent1}`,
      content: midweekContent1,
      type: "file",
      fileUrl: uploads["schedule_midweek_1.png"].url,
      fileName: "schedule_midweek_1.png",
      thumbnailUrl: uploads["schedule_midweek_1.png"].url,
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      eventStartDate: toYMD(lastMonday), eventEndDate: toYMD(lastSunday),
      categoryId: catMap["Meetings"],
    },
  });
  console.log("  Created midweek schedule (last week - past)");

  // This week (current)
  await prisma.notice.create({
    data: {
      title: `Midweek Meeting Schedule — ${fmtRange(thisMonday, thisSunday)}`,
      description: `Midweek meeting schedule for ${fmtRange(thisMonday, thisSunday)}\n\n${midweekContent1}`,
      content: midweekContent1,
      type: "file",
      fileUrl: uploads["schedule_midweek_1.png"].url,
      fileName: "schedule_midweek_1.png",
      thumbnailUrl: uploads["schedule_midweek_1.png"].url,
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      eventStartDate: toYMD(thisMonday), eventEndDate: toYMD(thisSunday),
      categoryId: catMap["Meetings"],
    },
  });
  console.log("  Created midweek schedule (current week)");

  // Next week
  await prisma.notice.create({
    data: {
      title: `Midweek Meeting Schedule — ${fmtRange(nextMonday, nextSunday)}`,
      description: `Midweek meeting schedule for ${fmtRange(nextMonday, nextSunday)}\n\n${midweekContent2}`,
      content: midweekContent2,
      type: "file",
      fileUrl: uploads["schedule_midweek_2.png"].url,
      fileName: "schedule_midweek_2.png",
      thumbnailUrl: uploads["schedule_midweek_2.png"].url,
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      eventStartDate: toYMD(nextMonday), eventEndDate: toYMD(nextSunday),
      categoryId: catMap["Meetings"],
    },
  });
  console.log("  Created midweek schedule (next week)");

  // Weekend schedule — next week
  await prisma.notice.create({
    data: {
      title: `Public Talk Schedule — ${fmtRange(nextMonday, nextSunday)}`,
      description: `Public talk schedule for ${fmtRange(nextMonday, nextSunday)}\n\n${weekendContent1}`,
      content: weekendContent1,
      type: "file",
      fileUrl: uploads["schedule_weekend_1.png"].url,
      fileName: "schedule_weekend_1.png",
      thumbnailUrl: uploads["schedule_weekend_1.png"].url,
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      eventStartDate: toYMD(nextMonday), eventEndDate: toYMD(nextSunday),
      categoryId: catMap["Meetings"],
    },
  });
  console.log("  Created weekend schedule (next week)");

  // ─── Pinned Announcement ───
  console.log("Creating regular notices...");
  await prisma.notice.create({
    data: {
      title: "Welcome to Our Noticeboard!",
      description: "This is where you will find all congregation announcements, meeting schedules, and upcoming events. Please check back regularly for updates.",
      type: "text",
      isPinned: true, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      categoryId: catMap["Announcements"],
    },
  });
  console.log("  Created welcome announcement (pinned)");

  // ─── Image notices ───
  await prisma.notice.create({
    data: {
      title: "Kingdom Hall Cleanup",
      description: "All publishers are invited to help with the Kingdom Hall cleanup on August 30, 2026 at 8:00 AM. Bring cleaning supplies if you can.",
      type: "image",
      fileUrl: uploads["notice_cleanup.png"].url,
      fileName: "notice_cleanup.png",
      thumbnailUrl: uploads["notice_cleanup.png"].url,
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: true,
      eventStartDate: toYMD(addDays(today, 16)),
      eventEndDate: toYMD(addDays(today, 16)),
      location: "Kingdom Hall, Talisay City",
      categoryId: catMap["Announcements"],
    },
  });
  console.log("  Created cleanup notice (image)");

  await prisma.notice.create({
    data: {
      title: "Field Ministry Campaign — August 2026",
      description: "Join us in the special field ministry campaign for August. Remember to bring your tracts and magazine subscriptions. Group arrangements will be announced at the midweek meeting.",
      type: "image",
      fileUrl: uploads["notice_ministry.png"].url,
      fileName: "notice_ministry.png",
      thumbnailUrl: uploads["notice_ministry.png"].url,
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      categoryId: catMap["Ministry"],
    },
  });
  console.log("  Created ministry campaign notice (image)");

  await prisma.notice.create({
    data: {
      title: "New Kingdom Hall Sign Installed",
      description: "Our new Kingdom Hall sign has been installed! Come by and see it. Thanks to all the brothers who helped with the installation.",
      type: "image",
      fileUrl: uploads["notice_sign.png"].url,
      fileName: "notice_sign.png",
      thumbnailUrl: uploads["notice_sign.png"].url,
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      categoryId: catMap["Announcements"],
    },
  });
  console.log("  Created sign notice (image)");

  // ─── Text notices ───
  await prisma.notice.create({
    data: {
      title: "Reminder: Meeting Attendance",
      description: "Please remember to arrive at least 10 minutes before the start of each meeting. This allows us to begin on time and shows respect for our worship.",
      type: "text",
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      categoryId: catMap["Announcements"],
    },
  });
  console.log("  Created attendance reminder (text)");

  await prisma.notice.create({
    data: {
      title: "Literature Available",
      description: "New literature is available at the literature counter. Please see brother Martinez after the meeting to pick up your copies. Available items include the new study Bible, tracts for the campaign, and meeting workbooks.",
      type: "text",
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      categoryId: catMap["Documents"],
    },
  });
  console.log("  Created literature notice (text)");

  await prisma.notice.create({
    data: {
      title: "CO Visit Next Month",
      description: "Our Circuit Overseer, brother Thompson, will be visiting our congregation the week of September 15-21, 2026. Please prepare for his visit and check the schedule for any meeting time changes.",
      type: "text",
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: true,
      eventStartDate: toYMD(addDays(today, 32)),
      eventEndDate: toYMD(addDays(today, 38)),
      categoryId: catMap["Events"],
    },
  });
  console.log("  Created CO visit notice (text)");

  // ─── Link notice ───
  await prisma.notice.create({
    data: {
      title: "JW Broadcasting",
      description: "Watch videos and listen to audio programs on JW Broadcasting.",
      type: "link",
      linkUrl: "https://www.jw.org/en/library/videos/",
      linkLabel: "Visit JW Broadcasting",
      isPinned: false, isPublished: true, isPublic: true,
      language: "en", showOnCalendar: false,
      categoryId: catMap["Documents"],
    },
  });
  console.log("  Created JW Broadcasting link notice");

  // ─── Special Events ───
  console.log("Creating special events...");

  await prisma.specialEvent.create({
    data: {
      title: "Congregation Picnic",
      type: "other",
      startDate: toYMD(addDays(today, 22)),
      endDate: toYMD(addDays(today, 22)),
      location: "Rizal Park, Talisay City",
      latitude: 10.2444,
      longitude: 123.8170,
      description: "All are invited to our annual congregation picnic! Bring your own food and drinks. Games and activities for all ages.",
      imageUrl: uploads["event_picnic.png"].url,
      showOnNoticeboard: true,
    },
  });
  console.log("  Created congregation picnic event");

  await prisma.specialEvent.create({
    data: {
      title: "Regional Convention 2026 — Persevere in Prayer",
      type: "convention",
      startDate: toYMD(addDays(today, 57)),
      endDate: toYMD(addDays(today, 59)),
      location: "Cebu City Sports Complex",
      latitude: 10.3157,
      longitude: 123.8854,
      description: "Regional Convention 2026. Theme: Persevere in Prayer. Registration opens August 15. All sessions open to the public.",
      imageUrl: uploads["event_convention.png"].url,
      showOnNoticeboard: true,
    },
  });
  console.log("  Created regional convention event");

  await prisma.specialEvent.create({
    data: {
      title: "Circuit Assembly — Stand Firm",
      type: "assembly",
      startDate: toYMD(addDays(today, 85)),
      endDate: toYMD(addDays(today, 85)),
      location: "Bohol Convention Center",
      description: "Circuit Assembly with Circuit Overseer. Morning session 9:00 AM, afternoon session 1:30 PM. Dedication and baptism scheduled.",
      imageUrl: uploads["event_assembly.png"].url,
      showOnNoticeboard: true,
    },
  });
  console.log("  Created circuit assembly event");

  await prisma.specialEvent.create({
    data: {
      title: "The Memorial",
      type: "memorial",
      startDate: toYMD(addDays(today, 230)),
      endDate: toYMD(addDays(today, 230)),
      location: "Kingdom Hall, Talisay City",
      description: "You are warmly invited to attend the Memorial of Christ's death. April 2, 2027 at 7:00 PM. All are welcome.",
      imageUrl: uploads["event_memorial.png"].url,
      showOnNoticeboard: true,
    },
  });
  console.log("  Created memorial event");

  // ─── Role Assignments (A/V & Security only — meeting parts are in the schedules) ───
  console.log("Creating A/V & Security role assignments...");

  const avSecurityCurrent = `Sound: M. Johnson
Microphones: A. Reyes
Stage: C. Cruz
Audio/Video: R. Davis
Security: J. Smith
Attendant: P. Garcia
Attendant: L. Tan`;

  const avSecurityNext = `Sound: P. Garcia
Microphones: J. Smith
Stage: L. Tan
Audio/Video: M. Johnson
Security: A. Reyes
Attendant: R. Davis
Attendant: C. Cruz`;

  const avSecurityLast = `Sound: R. Davis
Microphones: L. Tan
Stage: J. Smith
Audio/Video: P. Garcia
Security: M. Johnson
Attendant: A. Reyes
Attendant: C. Cruz`;

  // Last week (past)
  await prisma.roleAssignment.create({
    data: {
      title: `A/V & Security — Midweek — Week of ${lastMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      meetingType: "midweek",
      weekDate: toYMD(lastMonday),
      ocrText: avSecurityLast,
      ocrStatus: "done",
      isPublished: true,
      showOnNoticeboard: true,
    },
  });
  await prisma.roleAssignment.create({
    data: {
      title: `A/V & Security — Weekend — Week of ${lastMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      meetingType: "weekend",
      weekDate: toYMD(lastMonday),
      ocrText: avSecurityLast,
      ocrStatus: "done",
      isPublished: true,
      showOnNoticeboard: true,
    },
  });
  console.log("  Created A/V & Security roles (last week)");

  // Current week
  await prisma.roleAssignment.create({
    data: {
      title: `A/V & Security — Midweek — Week of ${thisMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      meetingType: "midweek",
      weekDate: toYMD(thisMonday),
      ocrText: avSecurityCurrent,
      ocrStatus: "done",
      isPublished: true,
      showOnNoticeboard: true,
    },
  });
  await prisma.roleAssignment.create({
    data: {
      title: `A/V & Security — Weekend — Week of ${thisMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      meetingType: "weekend",
      weekDate: toYMD(thisMonday),
      ocrText: avSecurityCurrent,
      ocrStatus: "done",
      isPublished: true,
      showOnNoticeboard: true,
    },
  });
  console.log("  Created A/V & Security roles (current week)");

  // Next week
  await prisma.roleAssignment.create({
    data: {
      title: `A/V & Security — Midweek — Week of ${nextMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      meetingType: "midweek",
      weekDate: toYMD(nextMonday),
      ocrText: avSecurityNext,
      ocrStatus: "done",
      isPublished: true,
      showOnNoticeboard: true,
    },
  });
  await prisma.roleAssignment.create({
    data: {
      title: `A/V & Security — Weekend — Week of ${nextMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      meetingType: "weekend",
      weekDate: toYMD(nextMonday),
      ocrText: avSecurityNext,
      ocrStatus: "done",
      isPublished: true,
      showOnNoticeboard: true,
    },
  });
  console.log("  Created A/V & Security roles (next week)");

  // ─── Settings (fake congregation info) ───
  console.log("Updating settings...");
  const fakeSettings = {
    congregationTitle: "Cebu City Central Congregation",
    midweekDay: "2",          // Tuesday
    midweekTime: "18:30",     // 6:30 PM
    weekendDay: "0",          // Sunday
    weekendTime: "10:00",     // 10:00 AM
    calendarStartDay: "1",    // Monday
    meetingLocation: "Kingdom Hall of Jehovah's Witnesses, Osmena Blvd, Cebu City",
    mapAddress: "Osmena Blvd, Cebu City, 6000 Cebu, Philippines",
    mapLat: "10.3157",
    mapLng: "123.8854",
    mapEmbedUrl: "",
  };
  for (const [key, value] of Object.entries(fakeSettings)) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (existing) {
      await prisma.setting.update({ where: { key }, data: { value } });
    } else {
      await prisma.setting.create({ data: { key, value } });
    }
  }
  console.log("  Updated all settings with fake congregation info");

  // ─── Summary ───
  const counts = {
    notices: await prisma.notice.count(),
    events: await prisma.specialEvent.count(),
    roles: await prisma.roleAssignment.count(),
    files: await prisma.uploadedFile.count(),
    categories: await prisma.category.count(),
  };
  console.log("\n=== Seed complete! ===");
  console.log("Counts:", counts);
}

main().catch(e => { console.error("Seed error:", e); process.exit(1); }).finally(() => prisma.$disconnect());
