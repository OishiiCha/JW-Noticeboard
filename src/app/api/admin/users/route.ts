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
        failedLoginAttempts: true,
        lockedUntil: true,
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
    const { name, email, role, permissions, generateTemp } = body;

    // Normalize: usernames are trimmed, emails trimmed + lowercased so
    // "Bob" / "bob" and "A@x.com" / "a@x.com" can't slip past the dup check
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || (!password && !generateTemp)) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
      return NextResponse.json({ error: "Username must be 3-40 characters (letters, numbers, . _ - only)" }, { status: 400 });
    }
    if (password && !generateTemp && password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Only super_admin can create super_admin; new users default to "admin"
    const assignedRole = role === "super_admin" ? "super_admin" : "admin";

    // Email is optional — use a unique placeholder if not provided
    const finalEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : `${username.toLowerCase()}@local`;

    // Check duplicates against username AND the final email (covers the
    // placeholder colliding with a previously used "@local" address)
    const existing = await db.user.findFirst({
      where: { OR: [{ username }, { email: finalEmail }] },
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
        email: finalEmail,
        password: hashedPassword,
        role: assignedRole,
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
  } catch (error: unknown) {
    // Unique-constraint race (two creates at once) → friendly 409 instead of 500
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Username or email already exists" }, { status: 409 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
