import { db } from "@/lib/db";
import { parseScheduleFields, fieldsToContent, sortFieldsByNum } from "@/lib/schedule-field-config";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY_RE = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\w*,?\\s+";

// Derive the event date(s) from the notice title:
//   "… — Thu, Aug 27"        → start = end = Aug 27
//   "… — Aug 31 – Sep 6"     → start = Aug 31, end = Sep 6
function titleDates(title: string, year: number): { start: string; end: string } | null {
  const m = title.match(new RegExp(`—\\s*(?:${DAY_RE})?([A-Za-z]{3,9})\\.?\\s+(\\d{1,2})(?:\\s*[–—-]\\s*(?:${DAY_RE})?([A-Za-z]{3,9})\\.?\\s+(\\d{1,2}))?\\s*$`));
  if (!m) return null;
  const monthIdx = (s: string) => MONTHS.indexOf(s.slice(0, 3).toLowerCase());
  const mi1 = monthIdx(m[1]);
  if (mi1 < 0) return null;
  const ymd = (y: number, mi: number, d: number) => `${y}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const start = ymd(year, mi1, parseInt(m[2], 10));
  if (m[3] && m[4]) {
    const mi2 = monthIdx(m[3]);
    if (mi2 < 0) return null;
    // Range crossing into next year (e.g. "Dec 29 – Jan 4")
    const endYear = mi2 < mi1 ? year + 1 : year;
    return { start, end: ymd(endYear, mi2, parseInt(m[4], 10)) };
  }
  return { start, end: start };
}

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
 *   - stored event dates not matching the date in the title (wrong-week cards)
 *
 * New format:
 *   - fields live only in `content`, ordered/numbered ("#1 Key: Value")
 *   - `description` is null
 *   - event dates match the title
 *   - at most one non-archived notice per exact title
 */
export async function migrateScheduleNotices(): Promise<{ normalized: number; deduped: number; datesFixed: number }> {
  const notices = await db.notice.findMany({
    where: {
      deletedAt: null,
      isArchived: false,
      OR: [
        { title: { startsWith: "Midweek Meeting Schedule" } },
        { title: { startsWith: "Public Talk Schedule" } },
      ],
    },
    select: { id: true, title: true, description: true, content: true, eventStartDate: true, eventEndDate: true, updatedAt: true },
  });

  let normalized = 0;
  let datesFixed = 0;
  const year = new Date().getFullYear();

  for (const n of notices) {
    // Prefer content; fall back to the old description blob
    const raw = n.content?.trim() ? n.content : (n.description || "");
    const fields = sortFieldsByNum(parseScheduleFields(raw));
    const cleanContent = fields.length > 0 ? fieldsToContent(fields) : (n.content || "");

    // Re-derive event dates from the title — a stored date that disagrees with
    // the title makes the board card show the wrong week
    const td = titleDates(n.title, year);
    const storedStart = (n.eventStartDate || "").slice(0, 10);
    const storedEnd = (n.eventEndDate || n.eventStartDate || "").slice(0, 10);
    const dateMismatch = td && (td.start !== storedStart || td.end !== storedEnd);

    const needsContentUpdate = (n.description !== null && n.description !== "") || cleanContent !== (n.content || "");
    if (!needsContentUpdate && !dateMismatch) continue;

    await db.notice.update({
      where: { id: n.id },
      data: {
        ...(needsContentUpdate ? { description: null, content: cleanContent } : {}),
        ...(dateMismatch && td ? { eventStartDate: td.start, eventEndDate: td.end } : {}),
      },
    });
    if (needsContentUpdate) normalized++;
    if (dateMismatch) datesFixed++;
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

  if (normalized > 0 || deduped > 0 || datesFixed > 0) {
    console.log(`[schedule-migration] normalized ${normalized} notice(s), fixed ${datesFixed} date(s), archived ${deduped} duplicate(s)`);
  }
  return { normalized, deduped, datesFixed };
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
