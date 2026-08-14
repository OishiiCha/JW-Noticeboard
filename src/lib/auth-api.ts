import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  interfaceLanguage?: string;
  permissions?: string;
}

export type PermissionModule = "notices" | "meetings" | "events";
export type PermissionAccess = "r" | "rw";

export interface PermissionEntry {
  id: PermissionModule;
  access: PermissionAccess;
}

export async function getAuthSession(): Promise<SessionUser | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const user = session.user as {
      id?: string;
      email?: string;
      name?: string | null;
      role?: string;
      interfaceLanguage?: string;
    };

    if (!user.email || !user.role || !user.id) return null;

    // Fetch permissions from DB for user role (not stored in JWT to keep token small)
    let permissions = "";
    if (user.role === "user") {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { permissions: true },
      });
      permissions = dbUser?.permissions || "";
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      interfaceLanguage: user.interfaceLanguage || "en",
      permissions,
    };
  } catch {
    return null;
  }
}

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === "super_admin";
}

export function isAdminOrAbove(user: SessionUser): boolean {
  return user.role === "super_admin" || user.role === "admin";
}

/**
 * Check if a user can access a module.
 * - super_admin: full access to everything
 * - admin: read/write content modules (notices, meetings, events) but NOT congregation settings
 * - user: only modules granted in permissions
 */
export function hasPermission(user: SessionUser, moduleId: PermissionModule, needWrite = false): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "admin") return true; // admins can manage all content modules

  if (user.role === "user") {
    try {
      const parsed = JSON.parse(user.permissions || "[]") as PermissionEntry[];
      const entry = parsed.find((p) => p.id === moduleId);
      if (!entry) return false;
      if (needWrite && entry.access !== "rw") return false;
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const user = await getAuthSession();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Please sign in." },
      { status: 401 }
    );
  }
  return user;
}

/** super_admin only — for congregation details (meeting days/times, calendar config) */
export async function requireSuperAdmin(): Promise<SessionUser | NextResponse> {
  const userOrResponse = await requireAuth();
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  if (userOrResponse.role === "super_admin") {
    return userOrResponse;
  }

  return NextResponse.json(
    { error: "Forbidden. Super admin access required." },
    { status: 403 }
  );
}

/** super_admin or admin — for content management and user administration */
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const userOrResponse = await requireAuth();
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  if (isAdminOrAbove(userOrResponse)) {
    return userOrResponse;
  }

  return NextResponse.json(
    { error: "Forbidden. Admin access required." },
    { status: 403 }
  );
}

/** Check module permission — for content routes that users may be granted access to */
export async function requirePermission(
  moduleId: PermissionModule,
  needWrite = false
): Promise<SessionUser | NextResponse> {
  const userOrResponse = await requireAuth();
  if (userOrResponse instanceof NextResponse) return userOrResponse;

  if (hasPermission(userOrResponse, moduleId, needWrite)) {
    return userOrResponse;
  }

  return NextResponse.json(
    { error: `Forbidden. You do not have ${needWrite ? "write" : "read"} access to ${moduleId}.` },
    { status: 403 }
  );
}
