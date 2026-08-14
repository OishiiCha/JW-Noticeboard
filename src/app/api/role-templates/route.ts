import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-api";

export async function GET() {
  try {
    const templates = await db.roleTemplate.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching role templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("meetings", true);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { name, meetingType, template } = body;

    if (!name || !template) {
      return NextResponse.json({ error: "Name and template are required" }, { status: 400 });
    }

    const roleTemplate = await db.roleTemplate.create({
      data: {
        name,
        meetingType: meetingType || "midweek",
        template,
      },
    });

    return NextResponse.json(roleTemplate, { status: 201 });
  } catch (error) {
    console.error("Error creating role template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePermission("meetings", true);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await db.roleTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting role template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
