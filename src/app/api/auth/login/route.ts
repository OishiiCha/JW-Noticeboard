import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 5 * 60_000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUsername = typeof body.username === "string" ? body.username.trim() : "";
    const { password } = body;

    if (!rawUsername || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // Generic rate limit (prevents brute-force spam)
    const rateKey = `login:${rawUsername.toLowerCase()}`;
    if (!rateLimit(rateKey, 20, 15 * 60_000)) {
      return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }

    // Find user by username or email (emails are stored lowercase)
    let user = await db.user.findUnique({ where: { username: rawUsername } });
    if (!user) {
      user = await db.user.findUnique({ where: { email: rawUsername.toLowerCase() } });
    }

    // If user not found or inactive
    if (!user || !user.password || !user.isActive) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);
      const remainingMin = Math.floor(remainingSec / 60);
      const remainingSecInMin = remainingSec % 60;
      const timeStr = remainingMin > 0
        ? `${remainingMin}m ${remainingSecInMin}s`
        : `${remainingSec}s`;
      return NextResponse.json({
        error: `Account locked due to too many failed attempts. Try again in ${timeStr}.`,
        locked: true,
      }, { status: 423 });
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      // Increment failed attempts
      const newAttempts = user.failedLoginAttempts + 1;
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // Lock the account
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
          },
        });
        return NextResponse.json({
          error: `Account locked for 5 minutes after ${MAX_FAILED_ATTEMPTS} failed attempts. Contact a super admin to unlock.`,
          locked: true,
        }, { status: 423 });
      } else {
        await db.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: newAttempts },
        });
        const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
        return NextResponse.json({
          error: `Invalid username or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`,
          attemptsRemaining: remaining,
        }, { status: 401 });
      }
    }

    // Success — reset failed attempts and lock
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    rateLimitReset(rateKey);

    // Return success — the client will call NextAuth's signIn() to create the session
    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
