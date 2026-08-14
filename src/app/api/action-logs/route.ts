import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, type SessionUser } from "@/lib/auth-api";

export async function GET(request: NextRequest) {
  const userOrResponse = await requireAdmin();
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const moduleFilter = searchParams.get("module");
    const action = searchParams.get("action");

    const where: Record<string, unknown> = {};
    if (moduleFilter) where.module = moduleFilter;
    if (action) where.action = action;

    const logs = await db.actionLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 500),
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error fetching action logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
