import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const file = await db.uploadedFile.findUnique({
      where: { id },
      select: {
        id: true,
        originalName: true,
        storedName: true,
        mimeType: true,
        size: true,
        data: true,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", file.mimeType);
    headers.set("Content-Length", String(file.size));
    headers.set("Content-Disposition", `inline; filename="${file.storedName}"`);
    // Cache for 1 year — files are immutable (identified by ID)
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(file.data, { headers });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.uploadedFile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
