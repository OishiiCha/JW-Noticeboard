import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // 1-12
    const year = searchParams.get("year");
    const publishedOnly = searchParams.get("published") !== "false";

    // Fetch settings for auto-generating recurring meetings
    const settings = await db.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      try { settingsMap[s.key] = JSON.parse(s.value); } catch { settingsMap[s.key] = s.value; }
    }

    const midweekDay = parseInt(settingsMap.midweekDay || "2", 10);
    const midweekTime = settingsMap.midweekTime || "18:30";
    const weekendDay = parseInt(settingsMap.weekendDay || "6", 10);
    const weekendTime = settingsMap.weekendTime || "15:00";
    const meetingLocation = settingsMap.meetingLocation || "Kingdom Hall";

    // Determine date range — default to current + next month
    const now = new Date();
    const y = year ? parseInt(year) : now.getFullYear();
    const m = month ? parseInt(month) - 1 : now.getMonth();
    const rangeStart = new Date(y, m, -6);
    const rangeEnd = new Date(y, m + 1, 7);

    const dateToYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const rangeStartStr = dateToYMD(rangeStart);
    const rangeEndStr = dateToYMD(rangeEnd);

    // Fetch manual meeting entries (for attached schedule files)
    const where: Record<string, unknown> = {
      date: { gte: rangeStartStr, lte: rangeEndStr },
    };
    if (publishedOnly) where.isPublished = true;

    const manualMeetings = await db.meetingSchedule.findMany({ where, orderBy: { date: "asc" } });
    const manualMap = new Map<string, typeof manualMeetings[number]>();
    for (const m of manualMeetings) manualMap.set(m.date, m);

    // Auto-generate recurring meetings
    const autoMeetings: typeof manualMeetings = [];
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      const dow = cursor.getDay();
      const dateStr = dateToYMD(cursor);
      const manual = manualMap.get(dateStr);

      if (dow === midweekDay) {
        autoMeetings.push({
          id: manual?.id || `auto-mid-${dateStr}`,
          meetingType: "midweek",
          date: dateStr,
          time: manual?.time || midweekTime,
          location: manual?.location || meetingLocation,
          scheduleFileUrl: manual?.scheduleFileUrl || null,
          scheduleFileName: manual?.scheduleFileName || null,
          notes: manual?.notes || null,
          isPublished: true,
          createdAt: manual?.createdAt || new Date(),
          updatedAt: manual?.updatedAt || new Date(),
        } as typeof manualMeetings[number]);
      }
      if (dow === weekendDay) {
        autoMeetings.push({
          id: manual?.id || `auto-end-${dateStr}`,
          meetingType: "weekend",
          date: dateStr,
          time: manual?.time || weekendTime,
          location: manual?.location || meetingLocation,
          scheduleFileUrl: manual?.scheduleFileUrl || null,
          scheduleFileName: manual?.scheduleFileName || null,
          notes: manual?.notes || null,
          isPublished: true,
          createdAt: manual?.createdAt || new Date(),
          updatedAt: manual?.updatedAt || new Date(),
        } as typeof manualMeetings[number]);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return NextResponse.json(autoMeetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("meetings", true);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { meetingType, date, time, location, scheduleFileUrl, scheduleFileName, notes, isPublished } = body;

    if (!meetingType || !date || !time) {
      return NextResponse.json({ error: "Meeting type, date, and time are required" }, { status: 400 });
    }

    const meeting = await db.meetingSchedule.create({
      data: {
        meetingType,
        date,
        time,
        location: location || null,
        scheduleFileUrl: scheduleFileUrl || null,
        scheduleFileName: scheduleFileName || null,
        notes: notes || null,
        isPublished: isPublished || false,
      },
    });

    return NextResponse.json(meeting, { status: 201 });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
  }
}
