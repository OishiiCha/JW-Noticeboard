import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth-api";

export async function GET() {
  try {
    const user = await getAuthSession();
    if (!user?.id) {
      return NextResponse.json([]);
    }

    const bookmarks = await db.bookmark.findMany({
      where: { userId: user.id },
      select: { noticeId: true },
    });

    return NextResponse.json(bookmarks.map((b) => b.noticeId));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthSession();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { noticeId, action } = await request.json();

    if (action === "add") {
      await db.bookmark.upsert({
        where: {
          userId_noticeId: {
            userId: user.id,
            noticeId,
          },
        },
        update: {},
        create: {
          userId: user.id,
          noticeId,
        },
      });
    } else if (action === "remove") {
      await db.bookmark.deleteMany({
        where: {
          userId: user.id,
          noticeId,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update bookmark" }, { status: 500 });
  }
}
