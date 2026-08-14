import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth-api";

export async function logAction(
  user: SessionUser | null,
  action: string,
  module: string,
  options?: {
    entityId?: string;
    entityName?: string;
    details?: Record<string, unknown>;
  }
) {
  try {
    await db.actionLog.create({
      data: {
        userId: user?.id || null,
        userEmail: user?.email || null,
        userRole: user?.role || null,
        action,
        module,
        entityId: options?.entityId || null,
        entityName: options?.entityName || null,
        details: options?.details ? JSON.stringify(options.details) : null,
      },
    });
  } catch (e) {
    console.error("Failed to log action:", e);
  }
}
