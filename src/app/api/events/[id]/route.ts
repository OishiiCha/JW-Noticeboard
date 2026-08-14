import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const event = await db.specialEvent.findUnique({ where: { id } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("events", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const event = await db.specialEvent.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.titleTl !== undefined && { titleTl: body.titleTl }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.startDate !== undefined && { startDate: body.startDate }),
        ...(body.endDate !== undefined && { endDate: body.endDate }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.latitude !== undefined && { latitude: body.latitude }),
        ...(body.longitude !== undefined && { longitude: body.longitude }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.zoomId !== undefined && { zoomId: body.zoomId }),
        ...(body.zoomPasscode !== undefined && { zoomPasscode: body.zoomPasscode }),
        ...(body.showOnNoticeboard !== undefined && { showOnNoticeboard: body.showOnNoticeboard }),
      },
    });

    await logAction(auth, "update", "events", { entityId: id, entityName: body.title || event.title });
    return NextResponse.json(event);
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("events", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const existing = await db.specialEvent.findUnique({ where: { id }, select: { title: true, startDate: true, endDate: true } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Delete any meeting overrides that fall within the event's date range
    // so cancelled meetings revert to normal when the event is removed
    const eventStart = existing.startDate;
    const eventEnd = existing.endDate || existing.startDate;
    await db.meetingOverride.deleteMany({
      where: {
        date: { gte: eventStart, lte: eventEnd },
      },
    });

    await db.specialEvent.delete({ where: { id } });
    await logAction(auth, "delete", "events", { entityId: id, entityName: existing?.title });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
