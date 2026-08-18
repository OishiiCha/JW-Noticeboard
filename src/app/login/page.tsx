"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Loader2, Lock } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Step 1: Validate credentials via our custom API (gives proper error messages)
      const checkRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        setError(checkData.error || "Invalid username or password");
        setLoading(false);
        return;
      }

      // Step 2: Create the NextAuth session
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        // This shouldn't happen since we already validated, but handle it
        setError("Login failed. Please try again.");
        setLoading(false);
      } else {
        // Hard redirect with replace so login page isn't in history
        window.location.replace("/");
      }
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  };

  const isLocked = error.toLowerCase().includes("locked");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-gray-950">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <img src="/jwnb_logo.png" alt="Logo" className="h-14 w-14 rounded-2xl object-cover" />
          </div>
          <CardTitle className="text-xl">Noticeboard</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to manage notices and meetings</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoFocus
                disabled={isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLocked}
              />
            </div>
            {error && (
              <div className={`rounded-lg p-3 text-sm text-center ${isLocked ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" : "text-red-500"}`}>
                {isLocked && <Lock className="h-4 w-4 mx-auto mb-1.5" />}
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={loading || isLocked}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
