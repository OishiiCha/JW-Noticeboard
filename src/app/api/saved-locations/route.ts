import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-api";

export async function GET() {
  try {
    const auth = await requirePermission("events", true);
    if (auth instanceof NextResponse) return auth;

    const locations = await db.savedLocation.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Error fetching saved locations:", error);
    return NextResponse.json({ error: "Failed to fetch saved locations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("events", true);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { name, address, latitude, longitude } = body;

    if (!name || !address || latitude == null || longitude == null) {
      return NextResponse.json({ error: "Name, address, latitude, and longitude are required" }, { status: 400 });
    }

    const location = await db.savedLocation.create({
      data: { name, address, latitude, longitude },
    });
    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error("Error creating saved location:", error);
    return NextResponse.json({ error: "Failed to create saved location" }, { status: 500 });
  }
}
