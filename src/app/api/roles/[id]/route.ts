import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const role = await db.roleAssignment.findUnique({ where: { id } });
    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(role);
  } catch (error) {
    console.error("Error fetching role:", error);
    return NextResponse.json({ error: "Failed to fetch role" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission("meetings", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();
    const { title, meetingType, weekDate, fileUrl, fileName, ocrText, ocrStatus, isPublished, showOnNoticeboard } = body;

    const role = await db.roleAssignment.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(meetingType !== undefined && { meetingType }),
        ...(weekDate !== undefined && { weekDate }),
        ...(fileUrl !== undefined && { fileUrl }),
        ...(fileName !== undefined && { fileName }),
        ...(ocrText !== undefined && { ocrText }),
        ...(ocrStatus !== undefined && { ocrStatus }),
        ...(isPublished !== undefined && { isPublished }),
        ...(showOnNoticeboard !== undefined && { showOnNoticeboard }),
      },
    });

    return NextResponse.json(role);
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission("meetings", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await db.roleAssignment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
