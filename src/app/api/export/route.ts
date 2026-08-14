import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, type SessionUser } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";
import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import { ZipArchive } from "archiver";
import { Writable } from "stream";

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const userOrResponse = await requireAdmin();
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const user = userOrResponse as SessionUser;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tmpDir = join(process.cwd(), "data", "tmp-export-" + randomBytes(8).toString("hex"));
    await mkdir(join(tmpDir, "notices"), { recursive: true });

    const notices = await db.notice.findMany({
      where: { deletedAt: null },
      include: {
        category: { select: { id: true, name: true, nameTl: true, color: true, icon: true } },
      },
      orderBy: [{ isArchived: "asc" }, { createdAt: "desc" }],
    });

    const manifest: Record<string, unknown>[] = [];
    const usedNames = new Set<string>();

    for (const notice of notices) {
      const safeTitle = notice.title.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 60).trim() || "untitled";
      const dateStr = new Date(notice.createdAt).toISOString().split("T")[0];
      let filename = `${dateStr}_${safeTitle}.txt`;
      let counter = 1;
      while (usedNames.has(filename)) {
        filename = `${dateStr}_${safeTitle}_${counter}.txt`;
        counter++;
      }
      usedNames.add(filename);

      const lines: string[] = [];
      lines.push(`Title: ${notice.title}`);
      if (notice.titleTl) lines.push(`Title (TL): ${notice.titleTl}`);
      lines.push(`Type: ${notice.type}`);
      lines.push(`Status: ${notice.isPublished ? "Published" : "Unpublished"}${notice.isArchived ? " (Archived)" : ""}`);
      if (notice.category) lines.push(`Category: ${notice.category.name}`);
      lines.push(`Language: ${notice.language}`);
      lines.push(`Audience: ${notice.audience}`);
      lines.push(`Created: ${new Date(notice.createdAt).toLocaleString()}`);
      if (notice.updatedAt) lines.push(`Updated: ${new Date(notice.updatedAt).toLocaleString()}`);
      if (notice.archivedAt) lines.push(`Archived: ${new Date(notice.archivedAt).toLocaleString()}`);
      if (notice.expiresAt) lines.push(`Expires: ${new Date(notice.expiresAt).toLocaleString()}`);
      lines.push("");
      if (notice.description) {
        lines.push("Description:");
        lines.push(notice.description);
        lines.push("");
      }
      if (notice.descriptionTl) {
        lines.push("Description (TL):");
        lines.push(notice.descriptionTl);
        lines.push("");
      }
      if (notice.content) {
        lines.push("Content:");
        lines.push(notice.content);
        lines.push("");
      }
      if (notice.linkUrl) {
        lines.push(`Link: ${notice.linkUrl}`);
        if (notice.linkLabel) lines.push(`Link Label: ${notice.linkLabel}`);
        lines.push("");
      }
      if (notice.fileUrl) {
        lines.push(`File: ${notice.fileUrl}`);
        if (notice.fileName) lines.push(`File Name: ${notice.fileName}`);
        lines.push("");
      }
      if (notice.thumbnailUrl) {
        lines.push(`Thumbnail: ${notice.thumbnailUrl}`);
        lines.push("");
      }
      if (notice.galleryUrls) {
        const urls = notice.galleryUrls.split(",").map(u => u.trim()).filter(Boolean);
        lines.push(`Gallery Images: ${urls.length}`);
        for (const url of urls) {
          lines.push(`  - ${url}`);
        }
        lines.push("");
      }

      await writeFile(join(tmpDir, "notices", filename), lines.join("\n"), "utf-8");

      manifest.push({
        id: notice.id,
        filename,
        title: notice.title,
        type: notice.type,
        category: notice.category?.name || null,
        isArchived: notice.isArchived,
        createdAt: notice.createdAt,
      });
    }

    await writeFile(join(tmpDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    await writeFile(join(tmpDir, "README.txt"),
      `Noticeboard Export\n` +
      `Exported: ${new Date().toLocaleString()}\n` +
      `Exported by: ${user.email}\n` +
      `Total notices: ${notices.length}\n\n` +
      `Contents:\n` +
      `  /notices/  - Each notice as a .txt file (named by date_title)\n` +
      `  /files/    - Attached files (images, PDFs, etc.)\n` +
      `  manifest.json - Machine-readable index of all exported notices\n`,
      "utf-8");

    const archive = new ZipArchive({ zlib: { level: 6 } });

    const noticeFiles = await readdir(join(tmpDir, "notices"));
    for (const f of noticeFiles) {
      archive.file(join(tmpDir, "notices", f), { name: `notices/${f}` });
    }

    for (const notice of notices) {
      if (notice.fileUrl) {
        const fp = join(process.cwd(), "public", notice.fileUrl);
        try {
          await readFile(fp);
          const fname = notice.fileUrl.split("/").pop() || "file";
          archive.file(fp, { name: `files/${fname}` });
        } catch {}
      }
      if (notice.galleryUrls) {
        const urls = notice.galleryUrls.split(",").map(u => u.trim()).filter(Boolean);
        for (const url of urls) {
          const fp = join(process.cwd(), "public", url);
          try {
            await readFile(fp);
            const fname = url.split("/").pop() || "image";
            archive.file(fp, { name: `files/${fname}` });
          } catch {}
        }
      }
    }

    archive.file(join(tmpDir, "manifest.json"), { name: "manifest.json" });
    archive.file(join(tmpDir, "README.txt"), { name: "README.txt" });

    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk: Buffer, _encoding: string, callback: () => void) {
        chunks.push(chunk);
        callback();
      },
    });

    archive.pipe(writable);
    archive.finalize();

    await new Promise<void>((resolve, reject) => {
      archive.on("end", () => resolve());
      archive.on("error", (err: Error) => reject(err));
      writable.on("finish", () => resolve());
    });

    const zipBuffer = Buffer.concat(chunks);

    await execAsync(`rm -rf "${tmpDir}"`);

    await logAction(user, "export", "notices", { entityId: "export", entityName: `export_${timestamp}.zip`, details: { count: notices.length } });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="noticeboard_export_${timestamp}.zip"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
