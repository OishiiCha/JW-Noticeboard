import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-api";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meeting = await db.meetingSchedule.findUnique({ where: { id } });
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    return NextResponse.json(meeting);
  } catch (error) {
    console.error("Error fetching meeting:", error);
    return NextResponse.json({ error: "Failed to fetch meeting" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("meetings", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const meeting = await db.meetingSchedule.update({
      where: { id },
      data: {
        ...(body.meetingType !== undefined && { meetingType: body.meetingType }),
        ...(body.date !== undefined && { date: body.date }),
        ...(body.time !== undefined && { time: body.time }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.scheduleFileUrl !== undefined && { scheduleFileUrl: body.scheduleFileUrl }),
        ...(body.scheduleFileName !== undefined && { scheduleFileName: body.scheduleFileName }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      },
    });

    return NextResponse.json(meeting);
  } catch (error) {
    console.error("Error updating meeting:", error);
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("meetings", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await db.meetingSchedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
  }
}
