"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, ShieldCheck, AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { parseScheduleFields } from "@/lib/schedule-field-config";

interface NoticeRow { id: string; title: string; content: string | null; eventStartDate: string | null; eventEndDate: string | null; }
interface RoleRow { id: string; title: string; meetingType: string; weekDate: string | null; ocrText: string | null; }

interface Assignment {
  name: string;
  part: string;
  source: string; // "Midweek Schedule", "Public Talk Schedule", "Roles (MW)"...
  date: string;   // Monday of that week
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Extract person names from an assignment value like "#12 John Smith (moderator)"
// or "Angel Valdezco/Gloria Pintor"
function namesFromValue(value: string): string[] {
  return value
    .replace(/#\d+/g, "")
    .replace(/\([^)]*\)/g, "")
    .split(/[\/&,]|\band\b/i)
    .map(s => s.trim())
    .filter(s => s.length > 3);
}

export function ReportsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clashes, setClashes] = useState<{ name: string; week: string; assignments: Assignment[] }[]>([]);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ normalized: number; deduped: number; datesFixed: number; thumbnailsFixed: number } | null>(null);

  const runCleanup = async () => {
    setRunningCleanup(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/admin/maintenance", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Cleanup failed", description: err.error || `HTTP ${res.status}`, variant: "destructive" });
        return;
      }
      const result = await res.json();
      setCleanupResult(result);
      toast({
        title: "Cleanup complete",
        description: `${result.normalized} normalized · ${result.datesFixed} dates fixed · ${result.deduped} duplicates archived · ${result.thumbnailsFixed} thumbnails restored`,
      });
    } catch {
      toast({ title: "Cleanup failed", description: "Network error — please try again.", variant: "destructive" });
    } finally {
      setRunningCleanup(false);
    }
  };

  const runCheck = async () => {
    setLoading(true);
    try {
      const [noticesRes, rolesRes] = await Promise.all([
        fetch("/api/notices?showExpired=true"),
        fetch("/api/roles"),
      ]);
      if (!noticesRes.ok || !rolesRes.ok) throw new Error();
      const notices: NoticeRow[] = await noticesRes.json();
      const roles: RoleRow[] = await rolesRes.json();

      const assignments: Assignment[] = [];

      for (const n of notices) {
        if (!n.content || !n.eventStartDate) continue;
        const isMidweek = n.title.startsWith("Midweek Meeting Schedule");
        const isPublicTalk = n.title.startsWith("Public Talk Schedule");
        if (!isMidweek && !isPublicTalk) continue;
        const week = mondayOf(n.eventStartDate.slice(0, 10));
        for (const f of parseScheduleFields(n.content)) {
          for (const name of namesFromValue(f.value)) {
            assignments.push({ name, part: f.key, source: isMidweek ? "Midweek Schedule" : "Public Talk Schedule", date: week });
          }
        }
      }

      for (const r of roles) {
        if (!r.ocrText || !r.weekDate) continue;
        const week = mondayOf(r.weekDate.slice(0, 10));
        for (const line of r.ocrText.split("\n")) {
          const idx = line.indexOf(":");
          if (idx <= 0) continue;
          const part = line.slice(0, idx).trim();
          for (const name of namesFromValue(line.slice(idx + 1))) {
            assignments.push({ name, part, source: r.meetingType === "midweek" ? "Roles (MW)" : "Roles (WE)", date: week });
          }
        }
      }

      // Same person with more than one assignment in the same week
      const byNameWeek = new Map<string, Assignment[]>();
      for (const a of assignments) {
        const key = `${a.date}|${a.name.toLowerCase()}`;
        byNameWeek.set(key, [...(byNameWeek.get(key) || []), a]);
      }
      const found: { name: string; week: string; assignments: Assignment[] }[] = [];
      for (const [key, list] of byNameWeek) {
        if (list.length > 1) {
          const [week, ...nameParts] = key.split("|");
          found.push({ week, name: list[0].name || nameParts.join("|"), assignments: list });
        }
      }
      found.sort((a, b) => b.week.localeCompare(a.week));
      setClashes(found);
    } catch {
      toast({ title: "Failed to run cross-check", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runCheck(); }, []);

  const fmtWeek = (monday: string) => {
    const d = new Date(monday + "T00:00:00");
    const end = new Date(d); end.setDate(d.getDate() + 6);
    return `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Roles ↔ Schedule Cross-Check</h3>
        </div>
        <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={runCheck} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Re-run
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Flags anyone assigned to more than one part in the same week — across the midweek schedule, public talk schedule, and weekly roles.
      </p>

      {/* Schedule cleanup / repair */}
      <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Fix & Clean Schedules</h3>
          </div>
          <Button size="sm" className="rounded-lg h-8 bg-indigo-600 hover:bg-indigo-700" onClick={runCleanup} disabled={runningCleanup}>
            {runningCleanup ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wrench className="h-3.5 w-3.5 mr-1" />}
            Run Cleanup
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Normalizes old-format schedules (moves text out of descriptions, cleans headers, orders by part number), fixes stored dates that don't match the title, archives exact duplicates, and restores missing schedule images/thumbnails.
        </p>
        {cleanupResult && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-xs font-medium text-green-700 dark:text-green-300">
              {cleanupResult.normalized} notice{cleanupResult.normalized === 1 ? "" : "s"} normalized · {cleanupResult.datesFixed} date{cleanupResult.datesFixed === 1 ? "" : "s"} fixed · {cleanupResult.deduped} duplicate{cleanupResult.deduped === 1 ? "" : "s"} archived · {cleanupResult.thumbnailsFixed} thumbnail{cleanupResult.thumbnailsFixed === 1 ? "" : "s"} restored
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Checking assignments…</p>
      ) : clashes.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 px-3 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-xs font-medium text-green-700 dark:text-green-300">No double-booked assignments found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clashes.slice(0, 50).map((c, i) => (
            <div key={i} className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/10 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm font-semibold">{c.name}</span>
                <span className="text-xs text-muted-foreground">{fmtWeek(c.week)}</span>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {c.assignments.map((a, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${a.source.includes("Midweek") ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : a.source.includes("Public") ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"}`}>
                      {a.source}
                    </span>
                    {a.part}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
