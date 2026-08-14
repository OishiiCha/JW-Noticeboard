import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-api";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("events", true);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    await db.savedLocation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved location:", error);
    return NextResponse.json({ error: "Failed to delete saved location" }, { status: 500 });
  }
}
