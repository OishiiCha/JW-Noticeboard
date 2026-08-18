// Runs once when the Next.js server boots (dev or production).
// Schedules the automatic nightly database backup.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runAutoBackup } = await import("@/lib/auto-backup");

  const run = async () => {
    try { await runAutoBackup(); } catch {}
  };

  // First check shortly after boot, then every 6 hours (the backup itself
  // skips if one was already made in the last 20 hours).
  setTimeout(run, 60_000).unref?.();
  setInterval(run, 6 * 60 * 60 * 1000).unref?.();
}
