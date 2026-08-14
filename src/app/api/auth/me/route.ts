import { NextResponse } from "next/server";
import { getAuthSession, hasPermission } from "@/lib/auth-api";

export async function GET() {
  const user = await getAuthSession();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      interfaceLanguage: user.interfaceLanguage,
      permissions: {
        notices: { read: hasPermission(user, "notices"), write: hasPermission(user, "notices", true) },
        meetings: { read: hasPermission(user, "meetings"), write: hasPermission(user, "meetings", true) },
        events: { read: hasPermission(user, "events"), write: hasPermission(user, "events", true) },
      },
    },
  });
}
