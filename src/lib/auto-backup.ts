import { db } from "@/lib/db";
import { readFile, writeFile, stat, mkdir, unlink, readdir, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

// Same table list as the manual backup in /api/backup
const BACKUP_TABLES = [
  "User", "Account", "Session", "VerificationToken",
  "Setting", "Category", "Notice", "NoticeRead",
  "MeetingSchedule", "SpecialEvent", "SavedLocation", "MeetingOverride",
  "RoleAssignment", "RoleTemplate",
  "Bookmark", "UploadedFile",
  "BackupLog", "ActionLog",
];

const BACKUP_DIR = join(process.cwd(), "data", "backups");
// Fallback when the primary dir isn't writable (e.g. dev running outside
// Docker while data/ is owned by the container user). Production (Docker)
// always uses BACKUP_DIR.
const FALLBACK_DIR = join(tmpdir(), "noticeboard-backups");
const MAX_AUTO_BACKUPS = 14; // keep two weeks of automatic backups

async function backupDir(): Promise<string> {
  await mkdir(BACKUP_DIR, { recursive: true }).catch(() => {});
  try {
    await access(BACKUP_DIR, fsConstants.W_OK);
    return BACKUP_DIR;
  } catch {
    await mkdir(FALLBACK_DIR, { recursive: true });
    return FALLBACK_DIR;
  }
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val instanceof Date) out[key] = val.toISOString();
    else if (typeof val === "bigint") out[key] = val.toString();
    else if (Buffer.isBuffer(val) || val instanceof Uint8Array) out[key] = { __base64: Buffer.from(val).toString("base64") };
    else out[key] = val;
  }
  return out;
}

/**
 * Create an automatic ("scheduled") backup: a JSON dump of every table to
 * data/backups, logged in BackupLog with type "auto". Old automatic backups
 * beyond MAX_AUTO_BACKUPS are pruned. Safe to call repeatedly — it skips if a
 * backup was already taken today.
 */
export async function runAutoBackup(): Promise<void> {
  const last = await db.backupLog.findFirst({
    where: { type: "auto", status: "success" },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < 20 * 60 * 60 * 1000) return; // already backed up in the last 20h

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `auto_backup_${timestamp}.json`;

  try {
    const backup: Record<string, unknown> = { _meta: { exportedAt: new Date().toISOString(), version: 2, auto: true } };
    for (const table of BACKUP_TABLES) {
      try {
        // db keys are the exact model names (db.RoleAssignment, not lowercase)
        // @ts-expect-error dynamic table access
        const rows = await db[table].findMany();
        backup[table] = (rows as Record<string, unknown>[]).map(r => serializeRow(r));
      } catch {
        backup[table] = [];
      }
    }

    const dir = await backupDir();
    const backupPath = join(dir, filename);
    await writeFile(backupPath, JSON.stringify(backup), "utf-8");
    const fileStat = await stat(backupPath);

    await db.backupLog.create({
      data: {
        id: randomBytes(16).toString("hex"),
        filename,
        size: fileStat.size,
        type: "auto",
        status: "success",
        createdBy: null,
      },
    });

    // Prune old automatic backups (keep the newest MAX_AUTO_BACKUPS)
    const autoLogs = await db.backupLog.findMany({
      where: { type: "auto" },
      orderBy: { createdAt: "desc" },
    });
    const stale = autoLogs.slice(MAX_AUTO_BACKUPS);
    for (const log of stale) {
      try { await unlink(join(dir, log.filename)); } catch {}
      await db.backupLog.delete({ where: { id: log.id } }).catch(() => {});
    }
  } catch (error) {
    console.error("Automatic backup failed:", error);
    try {
      await db.backupLog.create({
        data: {
          id: randomBytes(16).toString("hex"),
          filename,
          size: 0,
          type: "auto",
          status: "failed",
          createdBy: null,
        },
      });
    } catch {}
  }
}

// Guard so multiple server workers don't all try to back up at once
let backupChecked = false;
export async function runAutoBackupOncePerBoot(): Promise<void> {
  if (backupChecked) return;
  backupChecked = true;
  try { await runAutoBackup(); } catch {}
}

// Exported for tests / manual invocation
export async function verifyBackupDir(): Promise<string[]> {
  try { return await readdir(BACKUP_DIR); } catch { return []; }
}
export { BACKUP_DIR };
