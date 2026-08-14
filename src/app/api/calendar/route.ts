import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth-api";

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: "meeting" | "notice" | "special" | "override";
  title: string;
  subtitle?: string;
  isPublished: boolean;
  meta?: Record<string, unknown>;
}

function dateToYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const session = await getAuthSession();
    const isAdmin = session?.role === "admin";

    const now = new Date();
    const parsedYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
    const parsedMonth = monthParam ? parseInt(monthParam, 10) - 1 : now.getMonth();
    const year = Number.isNaN(parsedYear) ? now.getFullYear() : parsedYear;
    const month = Number.isNaN(parsedMonth) ? now.getMonth() : parsedMonth;

    const rangeStart = new Date(year, month, -6);
    const rangeEnd = new Date(year, month + 1, 7);
    const rangeStartStr = dateToYMD(rangeStart);
    const rangeEndStr = dateToYMD(rangeEnd);

    const events: CalendarEvent[] = [];

    // Fetch settings for auto-generating recurring meetings
    const settings = await db.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      try { settingsMap[s.key] = JSON.parse(s.value); } catch { settingsMap[s.key] = s.value; }
    }

    const midweekDay = parseInt(settingsMap.midweekDay || "2", 10); // 0=Sun, 1=Mon, ... 2=Tue default
    const midweekTime = settingsMap.midweekTime || "18:30";
    const weekendDay = parseInt(settingsMap.weekendDay || "6", 10); // 6=Sat default
    const weekendTime = settingsMap.weekendTime || "15:00";
    const meetingLocation = settingsMap.meetingLocation || "Kingdom Hall";
    const defaultZoomId = settingsMap.defaultZoomId || "";
    const defaultZoomPasscode = settingsMap.defaultZoomPasscode || "";

    // Auto-generate recurring meeting entries for the visible month range
    const autoMeetingDates: { date: string; meetingType: string; time: string }[] = [];
    const cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      const dow = cursor.getDay();
      if (dow === midweekDay) {
        autoMeetingDates.push({ date: dateToYMD(cursor), meetingType: "midweek", time: midweekTime });
      }
      if (dow === weekendDay) {
        autoMeetingDates.push({ date: dateToYMD(cursor), meetingType: "weekend", time: weekendTime });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Fetch meeting overrides first so we can suppress cancelled auto-meetings
    const overrides = await db.meetingOverride.findMany({
      where: {
        date: { gte: rangeStartStr, lte: rangeEndStr },
      },
    });

    // Build a set of overridden meeting keys to suppress auto-generated entries
    // Both cancellations and reschedules should hide the original auto-meeting
    const overriddenKeys = new Set<string>();
    for (const o of overrides) {
      overriddenKeys.add(`${o.date}:${o.meetingType}`);
    }

    // Fetch any manually created meeting schedules (for attached files/overrides)
    const manualMeetings = await db.meetingSchedule.findMany({
      where: {
        date: { gte: rangeStartStr, lte: rangeEndStr },
        ...(isAdmin ? {} : { isPublished: true }),
      },
    });
    const manualMeetingMap = new Map<string, typeof manualMeetings[number]>();
    for (const m of manualMeetings) {
      manualMeetingMap.set(m.date, m);
    }

    for (const am of autoMeetingDates) {
      // Skip auto-generated meeting if there's a cancellation override for this date+type
      if (overriddenKeys.has(`${am.date}:${am.meetingType}`)) continue;
      const manual = manualMeetingMap.get(am.date);
      events.push({
        id: `meeting-${am.date}`,
        date: am.date,
        type: "meeting",
        title: am.meetingType === "midweek" ? "MW" : "WE",
        subtitle: `${am.time} — ${meetingLocation}`,
        isPublished: true,
        meta: {
          meetingType: am.meetingType,
          fullTitle: am.meetingType === "midweek" ? "Midweek Meeting" : "Weekend Meeting",
          time: am.time,
          location: meetingLocation,
          scheduleFileUrl: manual?.scheduleFileUrl,
          scheduleFileName: manual?.scheduleFileName,
          zoomId: defaultZoomId || undefined,
          zoomPasscode: defaultZoomPasscode || undefined,
        },
      });
    }

    for (const o of overrides) {
      events.push({
        id: `override-${o.id}`,
        date: o.date,
        type: "override",
        title: o.isCancelled
          ? `${o.meetingType === "midweek" ? "MW" : "WE"} Meeting CANCELLED`
          : `${o.meetingType === "midweek" ? "MW" : "WE"} Meeting Moved`,
        subtitle: o.reason || undefined,
        isPublished: true,
        meta: { isCancelled: o.isCancelled, overrideDay: o.overrideDay, overrideTime: o.overrideTime },
      });
    }

    // Fetch special events
    const specialEvents = await db.specialEvent.findMany({
      where: {
        OR: [
          { startDate: { gte: rangeStartStr, lte: rangeEndStr } },
          { endDate: { gte: rangeStartStr, lte: rangeEndStr } },
          { startDate: { lte: rangeStartStr }, endDate: { gte: rangeEndStr } },
        ],
      },
    });

    for (const e of specialEvents) {
      // For multi-day events, add an entry for each day in range
      const start = e.startDate;
      const end = e.endDate || e.startDate;

      if (start === end) {
        events.push({
          id: `special-${e.id}`,
          date: start,
          type: "special",
          title: e.title,
          subtitle: e.location || undefined,
          isPublished: true,
          meta: { eventType: e.type, eventId: e.id, startDate: e.startDate, endDate: e.endDate, color: e.color, imageUrl: e.imageUrl, location: e.location, latitude: e.latitude, longitude: e.longitude, description: e.description, zoomId: e.zoomId, zoomPasscode: e.zoomPasscode },
        });
      } else {
        // Multi-day event — add entry for each day
        const current = new Date(start + "T00:00:00");
        const endDate = new Date(end + "T00:00:00");
        while (current <= endDate) {
          const dateStr = dateToYMD(current);
          if (dateStr >= rangeStartStr && dateStr <= rangeEndStr) {
            events.push({
              id: `special-${e.id}-${dateStr}`,
              date: dateStr,
              type: "special",
              title: e.title,
              subtitle: e.location || undefined,
              isPublished: true,
              meta: { eventType: e.type, eventId: e.id, startDate: e.startDate, endDate: e.endDate, color: e.color, imageUrl: e.imageUrl, multiDay: true, location: e.location, latitude: e.latitude, longitude: e.longitude, description: e.description, zoomId: e.zoomId, zoomPasscode: e.zoomPasscode },
            });
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }

    // Fetch notices with showOnCalendar and eventStartDate
    const calendarNotices = await db.notice.findMany({
      where: {
        deletedAt: null,
        showOnCalendar: true,
        eventStartDate: { not: null },
        isPublished: true,
        approvalStatus: "approved",
        OR: [
          { eventStartDate: { gte: rangeStartStr, lte: rangeEndStr } },
          { eventEndDate: { gte: rangeStartStr, lte: rangeEndStr } },
          { eventStartDate: { lte: rangeStartStr }, eventEndDate: { gte: rangeEndStr } },
        ],
      },
      include: { category: { select: { name: true, color: true } } },
    });

    for (const n of calendarNotices) {
      if (!n.eventStartDate) continue;
      const start = n.eventStartDate;
      const end = n.eventEndDate || n.eventStartDate;

      // Abbreviate meeting schedule titles for calendar tile display
      const isMidweekSchedule = n.title.toLowerCase().includes("midweek");
      const isPublicTalkSchedule = n.title.toLowerCase().includes("public talk");
      const shortTitle = isMidweekSchedule ? "MW" : isPublicTalkSchedule ? "WE" : n.title;

      if (start === end) {
        events.push({
          id: `notice-${n.id}`,
          date: start,
          type: "notice",
          title: shortTitle,
          subtitle: n.category?.name || undefined,
          isPublished: true,
          meta: { noticeType: n.type, noticeId: n.id, fileUrl: n.fileUrl, categoryColor: n.category?.color, fullTitle: n.title, startDate: n.eventStartDate, endDate: n.eventEndDate, location: n.location, latitude: n.latitude, longitude: n.longitude, description: n.description },
        });
      } else {
        const current = new Date(start + "T00:00:00");
        const endDate = new Date(end + "T00:00:00");
        while (current <= endDate) {
          const dateStr = dateToYMD(current);
          if (dateStr >= rangeStartStr && dateStr <= rangeEndStr) {
            events.push({
              id: `notice-${n.id}-${dateStr}`,
              date: dateStr,
              type: "notice",
              title: shortTitle,
              subtitle: n.category?.name || undefined,
              isPublished: true,
              meta: { noticeType: n.type, noticeId: n.id, fileUrl: n.fileUrl, multiDay: true, fullTitle: n.title, startDate: n.eventStartDate, endDate: n.eventEndDate, location: n.location, latitude: n.latitude, longitude: n.longitude, description: n.description },
            });
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }

    // Sort by date
    events.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json({ error: "Failed to fetch calendar events" }, { status: 500 });
  }
}
