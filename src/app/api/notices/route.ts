import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, requirePermission, isAdminOrAbove } from "@/lib/auth-api";
import { logAction } from "@/lib/action-log";

export async function GET(request: NextRequest) {
  try {
    // Auto-unpin notices whose pin expiry has passed (check first to avoid a write on every request)
    const expiredPin = await db.notice.findFirst({
      where: { isPinned: true, pinExpiresAt: { lt: new Date() } },
      select: { id: true },
    });
    if (expiredPin) {
      await db.notice.updateMany({
        where: {
          isPinned: true,
          pinExpiresAt: { lt: new Date() },
        },
        data: { isPinned: false, pinExpiresAt: null },
      });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const type = searchParams.get("type");
    const publishedOnly = searchParams.get("published") !== "false";
    const archivedOnly = searchParams.get("archived") === "true";
    const search = searchParams.get("search");
    const visitorMode = searchParams.get("visitor") === "true";
    const showExpired = searchParams.get("showExpired") === "true";
    const showScheduled = searchParams.get("showScheduled") === "true";
    const showPending = searchParams.get("showPending") === "true";

    const where: Record<string, unknown> = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;
    if (publishedOnly) where.isPublished = true;
    // Filter by isArchived: default exclude archived, unless archivedOnly is true
    if (archivedOnly) {
      where.isArchived = true;
    } else {
      where.isArchived = false;
    }

    if (visitorMode) {
      where.isPublic = true;
      where.approvalStatus = "approved";
    } else {
      const session = await getAuthSession();
      const isAdmin = session ? isAdminOrAbove(session) : false;
      if (!isAdmin && !showPending) {
        where.approvalStatus = "approved";
        where.audience = "all";
      }
    }

    const conditions: Record<string, unknown>[] = [];

    if (!showExpired) {
      conditions.push({
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      });
    }

    if (!showScheduled) {
      conditions.push({
        OR: [
          { publishAt: null },
          { publishAt: { lte: new Date() } },
        ],
      });
    }

    if (search) {
      conditions.push({
        OR: [
          { title: { contains: search } },
          { titleTl: { contains: search } },
          { description: { contains: search } },
          { descriptionTl: { contains: search } },
          { content: { contains: search } },
        ],
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const notices = await db.notice.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, nameTl: true, color: true, icon: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(notices);
  } catch (error) {
    console.error("Error fetching notices:", error);
    return NextResponse.json({ error: "Failed to fetch notices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission("notices", true);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      title,
      titleTl,
      description,
      descriptionTl,
      type,
      content,
      fileUrl,
      fileName,
      thumbnailUrl,
      linkUrl,
      linkIcon,
      linkLabel,
      galleryUrls,
      isPinned,
      isPublished,
      isPublic,
      audience,
      expiresAt,
      categoryId,
      language,
      eventStartDate,
      eventEndDate,
      publishAt,
      showOnCalendar,
      pinExpiresAt,
      location,
      latitude,
      longitude,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const isAdmin = isAdminOrAbove(auth);
    const approvalStatus = isAdmin ? "approved" : "pending";
    const isPublishedFinal = isAdmin ? (isPublished !== false) : false;

    const notice = await db.notice.create({
      data: {
        title,
        titleTl,
        description,
        descriptionTl,
        type: type || "text",
        content,
        fileUrl,
        fileName,
        thumbnailUrl,
        linkUrl,
        linkIcon,
        linkLabel,
        galleryUrls,
        isPinned: isPinned || false,
        isPublished: isPublishedFinal,
        isPublic: isPublic !== false,
        audience: audience || "all",
        showOnCalendar: showOnCalendar === true,
        eventStartDate: eventStartDate || null,
        eventEndDate: eventEndDate || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        pinExpiresAt: pinExpiresAt ? new Date(pinExpiresAt) : null,
        publishAt: publishAt ? new Date(publishAt) : null,
        approvalStatus,
        approvedBy: isAdmin ? auth.id : null,
        approvedAt: isAdmin ? new Date() : null,
        categoryId,
        createdBy: auth.id,
        language: language || "en",
        location: location || null,
        latitude: latitude || null,
        longitude: longitude || null,
      },
      include: { category: true },
    });

    await logAction(auth, "create", "notices", { entityId: notice.id, entityName: title });

    return NextResponse.json(notice, { status: 201 });
  } catch (error) {
    console.error("Error creating notice:", error);
    return NextResponse.json({ error: "Failed to create notice" }, { status: 500 });
  }
}
