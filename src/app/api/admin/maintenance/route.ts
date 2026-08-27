import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";
import { migrateScheduleNotices } from "@/lib/schedule-migration";

/**
 * Manual maintenance run — same normalization the server performs at boot,
 * plus repairs that need a one-off pass:
 *  - normalize schedule notices (description → content, header lines, #N order)
 *  - archive exact duplicate schedules
 *  - restore thumbnails for image schedules missing one
 */
export async function POST() {
  const auth = await requireSuperAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { normalized, deduped, datesFixed } = await migrateScheduleNotices();

    // Schedules with an image but no thumbnail — restore the thumbnail so the
    // board shows the schedule image again
    const noThumb = await db.notice.findMany({
      where: {
        deletedAt: null,
        isArchived: false,
        fileUrl: { not: null },
        thumbnailUrl: null,
        OR: [
          { title: { startsWith: "Midweek Meeting Schedule" } },
          { title: { startsWith: "Public Talk Schedule" } },
        ],
      },
      select: { id: true, fileUrl: true },
    });
    let thumbnailsFixed = 0;
    for (const n of noThumb) {
      if (!n.fileUrl) continue;
      await db.notice.update({
        where: { id: n.id },
        data: { thumbnailUrl: /\.pdf(\?|$)/i.test(n.fileUrl) ? null : n.fileUrl },
      });
      thumbnailsFixed++;
    }

    await logAction(auth, "update", "settings", {
      entityId: "maintenance",
      entityName: "Schedule cleanup",
      details: { normalized, deduped, datesFixed, thumbnailsFixed },
    });

    return NextResponse.json({ normalized, deduped, datesFixed, thumbnailsFixed });
  } catch (error) {
    console.error("Maintenance run failed:", error);
    return NextResponse.json({ error: "Maintenance run failed" }, { status: 500 });
  }
}
