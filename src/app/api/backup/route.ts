import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, type SessionUser } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, readdir, stat, mkdir, unlink, access } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { ZipArchive } from "archiver";
import { Writable } from "stream";

const execAsync = promisify(exec);

const BACKUP_DIR = join(process.cwd(), "data", "backups");
const UPLOADS_DIR = join(process.cwd(), "public", "uploads");

// Tables to backup/restore
const ALL_TABLES = [
  "User", "Account", "Session", "Category", "Notice", "Meeting",
  "SpecialEvent", "SavedLocation", "MeetingOverride", "RoleAssignment",
  "Bookmark", "UploadedFile", "Setting", "BackupLog", "ActionLog",
];

const RESTORE_TABLES = [
  "Category", "Notice", "Meeting", "SpecialEvent",
  "SavedLocation", "MeetingOverride", "RoleAssignment", "Setting",
];

export async function GET(request: NextRequest) {
  const userOrResponse = await requireAdmin();
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const user = userOrResponse as SessionUser;

  try {
    // List backup logs + files
    const logs = await db.backupLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error listing backups:", error);
    return NextResponse.json({ error: "Failed to list backups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userOrResponse = await requireAdmin();
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const user = userOrResponse as SessionUser;

  try {
    const contentType = request.headers.get("content-type") || "";

    // Handle multipart ZIP upload for restore
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Parse the ZIP to extract database.json and uploaded files
      const { exec } = await import("child_process");
      const tmpDir = join(process.cwd(), "data", "tmp-restore-" + randomBytes(8).toString("hex"));
      await mkdir(tmpDir, { recursive: true });
      const zipPath = join(tmpDir, "upload.zip");
      await writeFile(zipPath, buffer);

      // Use unzip command to extract
      try {
        await execAsync(`cd "${tmpDir}" && unzip -o "upload.zip"`);
      } catch {
        return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
      }

      // Read database.json
      let backupData: Record<string, unknown> = {};
      try {
        const raw = await readFile(join(tmpDir, "database.json"), "utf-8");
        backupData = JSON.parse(raw);
      } catch {
        await execAsync(`rm -rf "${tmpDir}"`);
        return NextResponse.json({ error: "No database.json found in ZIP" }, { status: 400 });
      }

      // Restore uploaded files
      const uploadsTmpDir = join(tmpDir, "uploads");
      try {
        await access(uploadsTmpDir);
        for (const subDir of ["notices", "schedules", "events", "roles"]) {
          const srcDir = join(uploadsTmpDir, subDir);
          try {
            const files = await readdir(srcDir);
            const destDir = join(UPLOADS_DIR, subDir);
            await mkdir(destDir, { recursive: true });
            for (const f of files) {
              try {
                const srcFile = join(srcDir, f);
                const destFile = join(destDir, f);
                const data = await readFile(srcFile);
                await writeFile(destFile, data);
              } catch {}
            }
          } catch {}
        }
      } catch {}

      // Restore database tables
      const restored: Record<string, number> = {};
      for (const table of RESTORE_TABLES) {
        const rows = backupData[table] as Record<string, unknown>[];
        if (!rows || !Array.isArray(rows)) continue;
        try {
          // @ts-expect-error dynamic table access
          await db[table.toLowerCase()].deleteMany({});
          for (const row of rows) {
            try {
              // @ts-expect-error dynamic table access
              await db[table.toLowerCase()].create({ data: row });
            } catch (e) {
              console.error(`Error restoring ${table} row:`, e);
            }
          }
          restored[table] = rows.length;
        } catch (e) {
          console.error(`Error restoring table ${table}:`, e);
          restored[table] = 0;
        }
      }

      await execAsync(`rm -rf "${tmpDir}"`);
      await logAction(user, "restore", "backup", { entityId: "upload", entityName: file.name, details: { restored } });

      return NextResponse.json({ success: true, restored });
    }

    const body = await request.json();
    const action = body.action || "create"; // "create" | "restore" | "delete"

    if (action === "create") {
      // Create a backup by dumping the SQLite DB to JSON
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `backup_${timestamp}.json`;
      const backupPath = join(BACKUP_DIR, filename);

      // Ensure backup directory exists
      const { mkdir } = await import("fs/promises");
      await mkdir(BACKUP_DIR, { recursive: true });

      // Export all tables to JSON using the DB
      const tables = [
        "User", "Account", "Session", "Category", "Notice", "Meeting",
        "SpecialEvent", "SavedLocation", "MeetingOverride", "RoleAssignment",
        "Bookmark", "UploadedFile", "Setting",
      ];

      const backup: Record<string, unknown> = { _meta: { exportedAt: new Date().toISOString(), version: 1 } };

      for (const table of tables) {
        try {
          // @ts-expect-error dynamic table access
          const rows = await db[table.toLowerCase()].findMany();
          backup[table] = rows;
        } catch {
          // Table might not exist or be empty
          backup[table] = [];
        }
      }

      const jsonStr = JSON.stringify(backup, null, 2);
      await writeFile(backupPath, jsonStr, "utf-8");
      const fileStat = await stat(backupPath);

      const log = await db.backupLog.create({
        data: {
          id: randomBytes(16).toString("hex"),
          filename,
          size: fileStat.size,
          type: "manual",
          status: "success",
          createdBy: user.email,
        },
      });

      await logAction(user, "backup", "backup", { entityId: log.id, entityName: filename });

      return NextResponse.json({ success: true, log });
    }

    if (action === "restore") {
      const { backupId } = body;
      if (!backupId) return NextResponse.json({ error: "backupId required" }, { status: 400 });

      const log = await db.backupLog.findUnique({ where: { id: backupId } });
      if (!log) return NextResponse.json({ error: "Backup not found" }, { status: 404 });

      const backupPath = join(BACKUP_DIR, log.filename);
      let backupData;
      try {
        const raw = await readFile(backupPath, "utf-8");
        backupData = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: "Backup file not found or corrupted" }, { status: 404 });
      }

      // Restore: only restore content tables (not auth tables to avoid breaking sessions)
      const restoreTables = [
        "Category", "Notice", "Meeting", "SpecialEvent",
        "SavedLocation", "MeetingOverride", "RoleAssignment", "Setting",
      ];

      const restored: Record<string, number> = {};

      for (const table of restoreTables) {
        const rows = backupData[table] as Record<string, unknown>[];
        if (!rows || !Array.isArray(rows)) continue;

        try {
          // @ts-expect-error dynamic table access
          await db[table.toLowerCase()].deleteMany({});
          for (const row of rows) {
            try {
              // @ts-expect-error dynamic table access
              await db[table.toLowerCase()].create({ data: row });
            } catch (e) {
              console.error(`Error restoring ${table} row:`, e);
            }
          }
          restored[table] = rows.length;
        } catch (e) {
          console.error(`Error restoring table ${table}:`, e);
          restored[table] = 0;
        }
      }

      await logAction(user, "restore", "backup", { entityId: backupId, entityName: log.filename, details: { restored } });

      return NextResponse.json({ success: true, restored });
    }

    if (action === "download") {
      // Create a full backup ZIP (database JSON + all uploaded files)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backup: Record<string, unknown> = { _meta: { exportedAt: new Date().toISOString(), version: 2 } };

      for (const table of ALL_TABLES) {
        try {
          // @ts-expect-error dynamic table access
          const rows = await db[table.toLowerCase()].findMany();
          backup[table] = rows;
        } catch {
          backup[table] = [];
        }
      }

      const archive = new ZipArchive({ zlib: { level: 6 } });

      // Add database JSON
      archive.append(JSON.stringify(backup, null, 2), { name: "database.json" });

      // Add all uploaded files
      for (const subDir of ["notices", "schedules", "events", "roles"]) {
        const dirPath = join(UPLOADS_DIR, subDir);
        try {
          const files = await readdir(dirPath);
          for (const f of files) {
            try {
              const fp = join(dirPath, f);
              const data = await readFile(fp);
              archive.append(data, { name: `uploads/${subDir}/${f}` });
            } catch {}
          }
        } catch {}
      }

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

      await logAction(user, "backup", "backup", { entityId: "download", entityName: `full_backup_${timestamp}.zip` });

      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="noticeboard_backup_${timestamp}.zip"`,
        },
      });
    }

    if (action === "restore-upload") {
      // Restore from uploaded ZIP (database.json + uploads/)
      const { backupData } = body;
      if (!backupData) return NextResponse.json({ error: "backupData required" }, { status: 400 });

      const data = typeof backupData === "string" ? JSON.parse(backupData) : backupData;

      const restored: Record<string, number> = {};

      for (const table of RESTORE_TABLES) {
        const rows = data[table] as Record<string, unknown>[];
        if (!rows || !Array.isArray(rows)) continue;

        try {
          // @ts-expect-error dynamic table access
          await db[table.toLowerCase()].deleteMany({});
          for (const row of rows) {
            try {
              // @ts-expect-error dynamic table access
              await db[table.toLowerCase()].create({ data: row });
            } catch (e) {
              console.error(`Error restoring ${table} row:`, e);
            }
          }
          restored[table] = rows.length;
        } catch (e) {
          console.error(`Error restoring table ${table}:`, e);
          restored[table] = 0;
        }
      }

      await logAction(user, "restore", "backup", { entityId: "upload", entityName: "uploaded_backup.zip", details: { restored } });

      return NextResponse.json({ success: true, restored });
    }

    if (action === "download-file") {
      const { backupId } = body;
      if (!backupId) return NextResponse.json({ error: "backupId required" }, { status: 400 });

      const log = await db.backupLog.findUnique({ where: { id: backupId } });
      if (!log) return NextResponse.json({ error: "Backup not found" }, { status: 404 });

      const backupPath = join(BACKUP_DIR, log.filename);
      let jsonStr: string;
      try {
        jsonStr = await readFile(backupPath, "utf-8");
      } catch {
        return NextResponse.json({ error: "Backup file not found on disk" }, { status: 404 });
      }

      // Build a ZIP with the database JSON + all uploaded files
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.append(jsonStr, { name: "database.json" });

      for (const subDir of ["notices", "schedules", "events", "roles"]) {
        const dirPath = join(UPLOADS_DIR, subDir);
        try {
          const files = await readdir(dirPath);
          for (const f of files) {
            try {
              const fp = join(dirPath, f);
              const data = await readFile(fp);
              archive.append(data, { name: `uploads/${subDir}/${f}` });
            } catch {}
          }
        } catch {}
      }

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
      const zipFilename = log.filename.replace(/\.json$/, ".zip");

      await logAction(user, "backup", "backup", { entityId: backupId, entityName: zipFilename });

      return new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFilename}"`,
        },
      });
    }

    if (action === "delete") {
      const { backupId } = body;
      if (!backupId) return NextResponse.json({ error: "backupId required" }, { status: 400 });

      const log = await db.backupLog.findUnique({ where: { id: backupId } });
      if (!log) return NextResponse.json({ error: "Backup not found" }, { status: 404 });

      // Delete file
      try {
        const { unlink } = await import("fs/promises");
        await unlink(join(BACKUP_DIR, log.filename));
      } catch {}

      await db.backupLog.delete({ where: { id: backupId } });
      await logAction(user, "delete", "backup", { entityId: backupId, entityName: log.filename });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json({ error: "Backup operation failed" }, { status: 500 });
  }
}
