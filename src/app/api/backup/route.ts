import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, type SessionUser } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, stat, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { ZipArchive } from "archiver";
import { Writable } from "stream";

const execAsync = promisify(exec);

const BACKUP_DIR = join(process.cwd(), "data", "backups");

// All Prisma models to include in a full backup
const ALL_TABLES = [
  "User", "Account", "Session", "VerificationToken",
  "Setting", "Category", "Notice", "NoticeRead",
  "MeetingSchedule", "SpecialEvent", "SavedLocation", "MeetingOverride",
  "RoleAssignment", "RoleTemplate",
  "Bookmark", "UploadedFile",
  "BackupLog", "ActionLog",
];

// Tables to restore (content + users + files — everything except auth sessions
// which would break the current session). Order matters for FK constraints.
const RESTORE_TABLES = [
  "User", "Account", "VerificationToken",
  "Setting", "Category", "Notice", "NoticeRead",
  "MeetingSchedule", "SpecialEvent", "SavedLocation", "MeetingOverride",
  "RoleAssignment", "RoleTemplate",
  "Bookmark", "UploadedFile",
  "BackupLog", "ActionLog",
];

// Tables that have Bytes fields that need base64 encode/decode
const BYTES_FIELDS: Record<string, string[]> = {
  UploadedFile: ["data"],
};

// Encode Buffer fields as base64 for JSON serialization
function encodeBytes(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const fields = BYTES_FIELDS[table];
  if (!fields) return rows;
  return rows.map(row => {
    const out = { ...row };
    for (const f of fields) {
      const val = out[f];
      if (val && typeof val === "object" && "type" in val && (val as { type: string }).type === "Buffer" && Array.isArray((val as unknown as { data: unknown[] }).data)) {
        out[f] = { __base64: Buffer.from((val as unknown as { data: number[] }).data).toString("base64") };
      } else if (Buffer.isBuffer(val)) {
        out[f] = { __base64: val.toString("base64") };
      } else if (val instanceof Uint8Array) {
        out[f] = { __base64: Buffer.from(val).toString("base64") };
      }
    }
    return out;
  });
}

// Decode base64 back to Buffer for Prisma restore. Handles both encodings:
// {__base64: "..."} (what encodeBytes produces) and {type: "Buffer", data: [...]}
// (what JSON round-tripping of serializeRow produces for UploadedFile BLOBs).
function decodeBytes(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const fields = BYTES_FIELDS[table];
  if (!fields) return rows;
  return rows.map(row => {
    const out = { ...row };
    for (const f of fields) {
      const val = out[f];
      if (val && typeof val === "object" && "__base64" in val) {
        out[f] = Buffer.from((val as { __base64: string }).__base64, "base64");
      } else if (val && typeof val === "object" && "type" in val && (val as { type: string }).type === "Buffer" && Array.isArray((val as unknown as { data: number[] }).data)) {
        out[f] = Buffer.from((val as unknown as { data: number[] }).data);
      }
    }
    return out;
  });
}

// Convert Prisma DateTime fields to ISO strings for JSON, and decode BigInt
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val instanceof Date) {
      out[key] = val.toISOString();
    } else if (typeof val === "bigint") {
      out[key] = val.toString();
    } else if (Buffer.isBuffer(val)) {
      out[key] = { type: "Buffer", data: Array.from(val) };
    } else if (val instanceof Uint8Array) {
      out[key] = { type: "Buffer", data: Array.from(val) };
    } else {
      out[key] = val;
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  const userOrResponse = await requireAdmin();
  if (userOrResponse instanceof NextResponse) return userOrResponse;
  const _user = userOrResponse as SessionUser;

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

      // Parse the ZIP to extract database.json
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

      await execAsync(`rm -rf "${tmpDir}"`);

      // Restore database tables (all tables from the ZIP)
      const restored: Record<string, number> = {};
      for (const table of RESTORE_TABLES) {
        const rows = backupData[table] as Record<string, unknown>[];
        if (!rows || !Array.isArray(rows)) continue;
        try {
          // @ts-expect-error dynamic table access
          await db[table].deleteMany({});
          const decoded = decodeBytes(table, rows);
          for (const row of decoded) {
            try {
              // @ts-expect-error dynamic table access
              await db[table].create({ data: row });
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

      await logAction(user, "restore", "backup", { entityId: "upload", entityName: file.name, details: { restored } });

      return NextResponse.json({ success: true, restored });
    }

    const body = await request.json();
    const action = body.action || "create"; // "create" | "restore" | "delete" | "download" | "download-file"

    if (action === "create") {
      // Create a backup by dumping the SQLite DB to JSON
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `backup_${timestamp}.json`;
      const backupPath = join(BACKUP_DIR, filename);

      await mkdir(BACKUP_DIR, { recursive: true });

      const backup: Record<string, unknown> = { _meta: { exportedAt: new Date().toISOString(), version: 2 } };

      for (const table of ALL_TABLES) {
        try {
          // @ts-expect-error dynamic table access
          const rows = await db[table].findMany();
          const serialized = (rows as Record<string, unknown>[]).map(r => serializeRow(r));
          backup[table] = encodeBytes(table, serialized);
        } catch {
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
      let backupData: Record<string, unknown>;
      try {
        const raw = await readFile(backupPath, "utf-8");
        backupData = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: "Backup file not found or corrupted" }, { status: 404 });
      }

      const restored: Record<string, number> = {};

      for (const table of RESTORE_TABLES) {
        const rows = backupData[table] as Record<string, unknown>[];
        if (!rows || !Array.isArray(rows)) continue;

        try {
          // @ts-expect-error dynamic table access
          await db[table].deleteMany({});
          const decoded = decodeBytes(table, rows);
          for (const row of decoded) {
            try {
              // @ts-expect-error dynamic table access
              await db[table].create({ data: row });
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
      // Create a full backup ZIP (database JSON with all tables + all file BLOBs)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backup: Record<string, unknown> = { _meta: { exportedAt: new Date().toISOString(), version: 2 } };

      for (const table of ALL_TABLES) {
        try {
          // @ts-expect-error dynamic table access
          const rows = await db[table].findMany();
          const serialized = (rows as Record<string, unknown>[]).map(r => serializeRow(r));
          backup[table] = encodeBytes(table, serialized);
        } catch {
          backup[table] = [];
        }
      }

      const archive = new ZipArchive({ zlib: { level: 6 } });

      // Add database JSON (includes all tables with file BLOBs as base64)
      archive.append(JSON.stringify(backup, null, 2), { name: "database.json" });

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
      // Restore from uploaded ZIP (database.json)
      const { backupData } = body;
      if (!backupData) return NextResponse.json({ error: "backupData required" }, { status: 400 });

      const data = typeof backupData === "string" ? JSON.parse(backupData) : backupData;

      const restored: Record<string, number> = {};

      for (const table of RESTORE_TABLES) {
        const rows = data[table] as Record<string, unknown>[];
        if (!rows || !Array.isArray(rows)) continue;

        try {
          // @ts-expect-error dynamic table access
          await db[table].deleteMany({});
          const decoded = decodeBytes(table, rows);
          for (const row of decoded) {
            try {
              // @ts-expect-error dynamic table access
              await db[table].create({ data: row });
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

      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.append(jsonStr, { name: "database.json" });

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

      try {
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
