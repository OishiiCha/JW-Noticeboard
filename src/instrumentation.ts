// Runs once when the Next.js server boots (dev or production).
// Schedules the automatic nightly database backup and the schedule-notice
// migration (normalizes old-format data, incl. anything an old backup
// restore brings back).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runAutoBackup } = await import("@/lib/auto-backup");
  const { runScheduleMigrationOnce } = await import("@/lib/schedule-migration");

  const run = async () => {
    try { await runScheduleMigrationOnce(); } catch {}
    try { await runAutoBackup(); } catch {}
  };

  // First check shortly after boot, then every 6 hours (the backup itself
  // skips if one was already made in the last 20 hours).
  setTimeout(run, 30_000).unref?.();
  setInterval(run, 6 * 60 * 60 * 1000).unref?.();
}
