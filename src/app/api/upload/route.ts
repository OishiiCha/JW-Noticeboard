import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

const MAX_IMAGE_DIM = 1200;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "notices";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Resize/compress images if too large
    let finalBuffer: Buffer = buffer;
    let outputExt = ext;

    if (IMAGE_TYPES.includes(file.type) || ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) {
      try {
        const sharp = (await import("sharp")).default;
        const image = sharp(buffer);
        const metadata = await image.metadata();

        let pipeline = image;
        let needsResize = false;

        if (metadata.width && metadata.width > MAX_IMAGE_DIM) {
          pipeline = pipeline.resize({ width: MAX_IMAGE_DIM, withoutEnlargement: true });
          needsResize = true;
        }
        if (metadata.height && metadata.height > MAX_IMAGE_DIM) {
          pipeline = pipeline.resize({ height: MAX_IMAGE_DIM, withoutEnlargement: true });
          needsResize = true;
        }

        const fileSizeKB = buffer.length / 1024;
        if (fileSizeKB > 500) {
          finalBuffer = await pipeline.webp({ quality: 82 }).toBuffer();
          outputExt = "webp";
        } else if (needsResize) {
          finalBuffer = await pipeline.toBuffer();
        }
      } catch {
        finalBuffer = buffer;
      }
    }

    // Auto-rename: timestamp-uuid-shortname.ext
    const timestamp = Date.now();
    const uuid = randomUUID().split("-")[0];
    const safeBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
    const storedName = `${timestamp}-${uuid}-${safeBase}.${outputExt}`;

    // Store as BLOB in database
    const uploadedFile = await db.uploadedFile.create({
      data: {
        originalName: file.name,
        storedName,
        mimeType: outputExt === "webp" ? "image/webp" : (file.type || "application/octet-stream"),
        size: finalBuffer.length,
        folder,
        data: new Uint8Array(finalBuffer),
        uploadedBy: auth.id,
      },
    });

    const fileUrl = `/api/files/${uploadedFile.id}`;

    return NextResponse.json({
      url: fileUrl,
      fileName: file.name,
      fileId: uploadedFile.id,
      size: finalBuffer.length,
      type: file.type,
    }, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
