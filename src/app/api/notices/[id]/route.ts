import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, isAdminOrAbove } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const notice = await db.notice.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!notice || notice.deletedAt) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }
    return NextResponse.json(notice);
  } catch (error) {
    console.error("Error fetching notice:", error);
    return NextResponse.json({ error: "Failed to fetch notice" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("notices", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    const isAdmin = isAdminOrAbove(auth);
    const editableFields = [
      "title", "titleTl", "description", "descriptionTl", "type", "content",
      "fileUrl", "fileName", "thumbnailUrl", "linkUrl", "linkIcon", "linkLabel",
      "galleryUrls", "isPinned", "isPublic", "audience", "categoryId", "language",
      "showOnCalendar", "eventStartDate", "eventEndDate", "publishAt",
      "location", "latitude", "longitude",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of editableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (updateData.expiresAt) updateData.expiresAt = new Date(updateData.expiresAt as string);
    if (updateData.pinExpiresAt) updateData.pinExpiresAt = new Date(updateData.pinExpiresAt as string);
    if (updateData.publishAt) updateData.publishAt = new Date(updateData.publishAt as string);

    if (isAdmin && body.isPublished !== undefined) {
      updateData.isPublished = body.isPublished;
    }

    // Handle archive/restore
    if (isAdmin && body.isArchived !== undefined) {
      updateData.isArchived = body.isArchived;
      updateData.archivedAt = body.isArchived ? new Date() : null;
    }

    if (!isAdmin) {
      const existing = await db.notice.findUnique({ where: { id }, select: { approvalStatus: true } });
      if (existing && existing.approvalStatus !== "approved") {
        updateData.approvalStatus = "pending";
        updateData.approvedBy = null;
        updateData.approvedAt = null;
        updateData.rejectionReason = null;
        updateData.isPublished = false;
      }
    }

    const notice = await db.notice.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });
    await logAction(auth, "update", "notices", { entityId: id, entityName: body.title || notice.title });
    return NextResponse.json(notice);
  } catch (error) {
    console.error("Error updating notice:", error);
    return NextResponse.json({ error: "Failed to update notice" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("notices", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const existing = await db.notice.findUnique({ where: { id }, select: { title: true } });
    await db.notice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await logAction(auth, "delete", "notices", { entityId: id, entityName: existing?.title });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notice:", error);
    return NextResponse.json({ error: "Failed to delete notice" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("notices", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { action } = await request.json();

    if (action === "restore") {
      await db.notice.update({
        where: { id },
        data: { deletedAt: null },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error patching notice:", error);
    return NextResponse.json({ error: "Failed to patch notice" }, { status: 500 });
  }
}
