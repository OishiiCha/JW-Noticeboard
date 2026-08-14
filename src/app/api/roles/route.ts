import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, requireAuth } from "@/lib/auth-api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const publishedOnly = searchParams.get("published") === "true";
    const visitorMode = searchParams.get("visitor") === "true";

    const where: Record<string, unknown> = {};
    if (publishedOnly || visitorMode) where.isPublished = true;
    if (visitorMode) where.showOnNoticeboard = true;

    const roles = await db.roleAssignment.findMany({
      where,
      orderBy: { weekDate: "desc" },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("meetings", true);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { title, meetingType, weekDate, fileUrl, fileName, ocrText, ocrStatus, isPublished, showOnNoticeboard } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const role = await db.roleAssignment.create({
      data: {
        title,
        meetingType: meetingType || "midweek",
        weekDate: weekDate || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        ocrText: ocrText || null,
        ocrStatus: ocrStatus || "none",
        isPublished: isPublished !== false,
        showOnNoticeboard: showOnNoticeboard !== false,
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("Error creating role assignment:", error);
    return NextResponse.json({ error: "Failed to create role assignment" }, { status: 500 });
  }
}
