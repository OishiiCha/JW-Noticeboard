import { db } from "@/lib/db";
import { parseScheduleFields, fieldsToContent, sortFieldsByNum } from "@/lib/schedule-field-config";

/**
 * One-time-per-database normalization of meeting schedule notices, run
 * automatically at server boot. Idempotent: notices already in the new format
 * are left untouched, so it is safe on every boot and re-runs automatically
 * if an old backup is restored later.
 *
 * Old format (problems):
 *   - text duplicated into `description` ("Midweek meeting schedule for ...")
 *   - header lines and "#N" part numbers embedded inconsistently
 *   - exact-duplicate notices created before the conflict dialog existed
 *
 * New format:
 *   - fields live only in `content`, ordered/numbered ("#1 Key: Value")
 *   - `description` is null
 *   - at most one non-archived notice per exact title
 */
export async function migrateScheduleNotices(): Promise<{ normalized: number; deduped: number }> {
  const notices = await db.notice.findMany({
    where: {
      deletedAt: null,
      isArchived: false,
      OR: [
        { title: { startsWith: "Midweek Meeting Schedule" } },
        { title: { startsWith: "Public Talk Schedule" } },
      ],
    },
    select: { id: true, title: true, description: true, content: true, updatedAt: true },
  });

  let normalized = 0;

  for (const n of notices) {
    // Prefer content; fall back to the old description blob
    const raw = n.content?.trim() ? n.content : (n.description || "");
    const fields = sortFieldsByNum(parseScheduleFields(raw));
    const cleanContent = fields.length > 0 ? fieldsToContent(fields) : (n.content || "");

    const needsUpdate = (n.description !== null && n.description !== "") || cleanContent !== (n.content || "");
    if (!needsUpdate) continue;

    await db.notice.update({
      where: { id: n.id },
      data: { description: null, content: cleanContent },
    });
    normalized++;
  }

  // Dedupe exact duplicates (same title = same schedule + date label): keep
  // the most recently updated, archive the rest. Archiving (not deleting) so
  // nothing is ever lost.
  let deduped = 0;
  const byTitle = new Map<string, typeof notices>();
  for (const n of notices) {
    byTitle.set(n.title, [...(byTitle.get(n.title) || []), n]);
  }
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    for (const stale of sorted.slice(1)) {
      await db.notice.update({
        where: { id: stale.id },
        data: { isArchived: true, archivedAt: new Date() },
      });
      deduped++;
    }
  }

  if (normalized > 0 || deduped > 0) {
    console.log(`[schedule-migration] normalized ${normalized} notice(s), archived ${deduped} duplicate(s)`);
  }
  return { normalized, deduped };
}

let migrated = false;
/** Run the migration once per server process (after a short boot delay). */
export async function runScheduleMigrationOnce(): Promise<void> {
  if (migrated) return;
  migrated = true;
  try {
    await migrateScheduleNotices();
  } catch (error) {
    console.error("[schedule-migration] failed:", error);
    // Allow a retry on the next scheduled tick rather than permanently skipping
    migrated = false;
  }
}
