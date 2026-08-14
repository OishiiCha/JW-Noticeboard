import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-api";
import { hash } from "bcryptjs";
import { generateTempPassword } from "@/lib/temp-password";

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth instanceof NextResponse) return auth;

    const users = await db.user.findMany({
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
        interfaceLanguage: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { name, username, email, password, role, permissions, generateTemp } = body;

    if (!username || (!password && !generateTemp)) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const existing = await db.user.findFirst({
      where: { OR: [{ username }, { email: email || "" }] },
    });
    if (existing) {
      return NextResponse.json({ error: "Username or email already exists" }, { status: 409 });
    }

    const tempPassword = generateTemp ? generateTempPassword() : null;
    const hashedPassword = await hash(tempPassword || password, 12);

    const user = await db.user.create({
      data: {
        name: name || username,
        username,
        email: email || `${username}@local`,
        password: hashedPassword,
        role: role || "user",
        permissions: typeof permissions === "string" ? permissions : JSON.stringify(permissions || []),
        isActive: true,
        mustChangePassword: !!tempPassword,
        tempPassword,
      },
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

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
