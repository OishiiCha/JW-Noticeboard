import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";

export async function GET() {
  try {
    const settings = await db.setting.findMany();
    const map: Record<string, unknown> = {};
    for (const s of settings) {
      try {
        map[s.key] = JSON.parse(s.value);
      } catch {
        map[s.key] = s.value;
      }
    }
    return NextResponse.json(map);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();

    // Validate that body is a non-empty object
    if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
      return NextResponse.json({ error: "No settings to save" }, { status: 400 });
    }

    // Use individual upserts instead of $transaction to avoid issues with extended client
    for (const [key, value] of Object.entries(body)) {
      await db.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      });
    }

    logAction(auth, "update", "settings", { details: { keys: Object.keys(body) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to update settings: ${message}` }, { status: 500 });
  }
}
