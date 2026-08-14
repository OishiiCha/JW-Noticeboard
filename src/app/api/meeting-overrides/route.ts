import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-api";

export async function GET() {
  try {
    const overrides = await db.meetingOverride.findMany({
      orderBy: { date: "asc" },
    });
    return NextResponse.json(overrides);
  } catch (error) {
    console.error("Error fetching meeting overrides:", error);
    return NextResponse.json({ error: "Failed to fetch overrides" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { date, meetingType, originalDay, isCancelled, reason, overrideDay, overrideTime, createNotice } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const override = await db.meetingOverride.upsert({
      where: { date_meetingType: { date, meetingType: meetingType || "midweek" } },
      update: {
        originalDay: originalDay ?? undefined,
        isCancelled: isCancelled ?? true,
        reason: reason || undefined,
        overrideDay: overrideDay ?? undefined,
        overrideTime: overrideTime || undefined,
      },
      create: {
        date,
        meetingType: meetingType || "midweek",
        originalDay: originalDay ?? undefined,
        isCancelled: isCancelled ?? true,
        reason: reason || undefined,
        overrideDay: overrideDay ?? undefined,
        overrideTime: overrideTime || undefined,
      },
    });

    // Optionally create a notice on the board
    if (createNotice) {
      const meetingLabel = meetingType === "midweek" ? "Midweek Meeting" : "Weekend Meeting";
      const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      if (isCancelled) {
        await db.notice.create({
          data: {
            title: `${meetingLabel} Cancelled — ${formattedDate}`,
            description: reason || `${meetingLabel} on ${formattedDate} has been cancelled.`,
            type: "text",
            content: reason || undefined,
            isPinned: true,
            isPublished: true,
            isPublic: true,
            language: "en",
            showOnCalendar: false,
            eventStartDate: date,
          },
        });
      } else {
        const newDayLabel = overrideDay !== null && overrideDay !== undefined
          ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][overrideDay]
          : null;
        const timeStr = overrideTime || "";
        const newSchedule = [newDayLabel, timeStr].filter(Boolean).join(" at ");
        await db.notice.create({
          data: {
            title: `${meetingLabel} Rescheduled — ${formattedDate}`,
            description: reason || `${meetingLabel} on ${formattedDate} has been moved${newSchedule ? ` to ${newSchedule}` : ""}.`,
            type: "text",
            content: reason || undefined,
            isPinned: true,
            isPublished: true,
            isPublic: true,
            language: "en",
            showOnCalendar: false,
            eventStartDate: date,
          },
        });
      }
    }

    return NextResponse.json(override);
  } catch (error) {
    console.error("Error creating meeting override:", error);
    return NextResponse.json({ error: "Failed to create override" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const meetingType = searchParams.get("meetingType") || "midweek";

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    await db.meetingOverride.delete({ where: { date_meetingType: { date, meetingType } } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting meeting override:", error);
    return NextResponse.json({ error: "Failed to delete override" }, { status: 500 });
  }
}
