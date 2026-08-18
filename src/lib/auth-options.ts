import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const rawUsername = credentials.username.trim();

        let user = await db.user.findUnique({
          where: { username: rawUsername },
        });
        if (!user) {
          user = await db.user.findUnique({
            where: { email: rawUsername.toLowerCase() },
          });
        }

        if (!user || !user.password || !user.isActive) {
          return null;
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          role: user.role,
          interfaceLanguage: user.interfaceLanguage || "en",
          mustChangePassword: user.mustChangePassword,
          tokenVersion: user.tokenVersion,
          permissions: user.permissions || "",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role;
        token.id = user.id;
        token.username = (user as { username?: string }).username || "";
        token.interfaceLanguage =
          (user as { interfaceLanguage?: string }).interfaceLanguage || "en";
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword || false;
        token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion || 0;
      }
      if (token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true, isActive: true, mustChangePassword: true },
        });
        if (!dbUser || !dbUser.isActive) {
          return { ...token, role: "", id: "" } as typeof token;
        }
        if (dbUser.tokenVersion !== token.tokenVersion) {
          return { ...token, role: "", id: "" } as typeof token;
        }
        // Keep mustChangePassword fresh so the forced change modal clears after a password update
        token.mustChangePassword = dbUser.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { username?: string }).username = token.username as string;
        (session.user as { interfaceLanguage?: string }).interfaceLanguage =
          (token.interfaceLanguage as string) || "en";
        (session.user as { mustChangePassword?: boolean }).mustChangePassword =
          (token.mustChangePassword as boolean) || false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: parseInt(process.env.SESSION_TIMEOUT_HOURS || "720", 10) * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || "noticeboard-app-dev-secret",
};
