import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    if (year && month) {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
      const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      // Events that overlap with the requested month
      where.OR = [
        { startDate: { gte: startDate, lt: endDate } },
        { endDate: { gte: startDate, lt: endDate } },
        { startDate: { lte: startDate }, endDate: { gte: endDate } },
      ];
    }

    const events = await db.specialEvent.findMany({
      where,
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("events", true);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { title, titleTl, type, startDate, endDate, location, latitude, longitude, description, imageUrl, color, zoomId, zoomPasscode, showOnNoticeboard } = body;

    if (!title || !startDate) {
      return NextResponse.json({ error: "Title and start date are required" }, { status: 400 });
    }

    const event = await db.specialEvent.create({
      data: {
        title,
        titleTl: titleTl || null,
        type: type || "other",
        startDate,
        endDate: endDate || null,
        location: location || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        description: description || null,
        imageUrl: imageUrl || null,
        color: color || null,
        zoomId: zoomId || null,
        zoomPasscode: zoomPasscode || null,
        showOnNoticeboard: showOnNoticeboard !== false,
      },
    });

    await logAction(auth, "create", "events", { entityId: event.id, entityName: title });
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
