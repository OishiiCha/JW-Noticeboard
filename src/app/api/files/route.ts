import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-api";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder");

    const where = folder ? { folder } : {};

    const files = await db.uploadedFile.findMany({
      where,
      select: {
        id: true,
        originalName: true,
        storedName: true,
        mimeType: true,
        size: true,
        folder: true,
        uploadedBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(files);
  } catch (error) {
    console.error("Error listing files:", error);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
