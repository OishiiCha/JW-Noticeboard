import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-api";
import { hash } from "bcryptjs";
import { generateTempPassword } from "@/lib/temp-password";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await request.json();

    // Generate a new 5-character temporary password (forgotten password flow)
    if (body.resetTempPassword) {
      const tempPassword = generateTempPassword();
      const user = await db.user.update({
        where: { id },
        data: {
          password: await hash(tempPassword, 12),
          tempPassword,
          mustChangePassword: true,
          tokenVersion: { increment: 1 }, // invalidate existing sessions
        },
        select: { id: true, tempPassword: true, mustChangePassword: true },
      });
      return NextResponse.json(user);
    }

    const updateData: Record<string, unknown> = {};

    // Prevent changing username or role of existing super_admin users
    const existingUser = await db.user.findUnique({ where: { id }, select: { role: true, username: true } });
    if (existingUser?.role === "super_admin") {
      if (body.username !== undefined && body.username !== existingUser.username) {
        return NextResponse.json({ error: "Super admin username cannot be changed" }, { status: 400 });
      }
      if (body.role !== undefined && body.role !== "super_admin") {
        return NextResponse.json({ error: "Super admin role cannot be changed" }, { status: 400 });
      }
    } else {
      // Non-super-admin users can only be "admin"
      if (body.role !== undefined && body.role !== "admin") {
        return NextResponse.json({ error: "Only admin role is allowed for non-super-admin users" }, { status: 400 });
      }
    }

    if (body.name !== undefined) updateData.name = body.name;
    if (body.username !== undefined) updateData.username = body.username;
    if (body.email !== undefined) {
      // Use unique placeholder if email is empty
      const username = existingUser?.username || body.username || "";
      updateData.email = body.email && body.email.trim() ? body.email.trim() : `${username}@local`;
    }
    if (body.role !== undefined) updateData.role = body.role;
    if (body.permissions !== undefined) {
      updateData.permissions = typeof body.permissions === "string" ? body.permissions : JSON.stringify(body.permissions || []);
    }
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.interfaceLanguage !== undefined) updateData.interfaceLanguage = body.interfaceLanguage;

    if (body.password) {
      updateData.password = await hash(body.password, 12);
      updateData.tempPassword = null; // manually set password — no temp password to display
      updateData.mustChangePassword = false;
      updateData.tokenVersion = { increment: 1 }; // invalidate sessions
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        mustChangePassword: true,
        tempPassword: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSuperAdmin();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    // Prevent deleting yourself
    if (id === auth.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // Prevent deleting super_admin users
    const target = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === "super_admin") {
      return NextResponse.json({ error: "Super admin accounts cannot be deleted" }, { status: 400 });
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
