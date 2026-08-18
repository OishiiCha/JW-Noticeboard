"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, History } from "lucide-react";

interface ActionLogRow {
  id: string;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  module: string;
  entityName: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  restore: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  backup: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
};

export function LogsPanel() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActionLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/action-logs?limit=200${moduleFilter ? `&module=${moduleFilter}` : ""}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      toast({ title: "Failed to load activity log", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const modules = ["", "notices", "roles", "events", "meetings", "users", "settings", "backup"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Recent Activity</h3>
          <span className="text-xs text-muted-foreground">({logs.length} entries)</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-lg border border-border/40 bg-background px-2 py-1.5 text-xs"
          >
            {modules.map(m => (
              <option key={m} value={m}>{m || "All modules"}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Who</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Module</th>
                <th className="px-3 py-2 font-semibold">What</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t border-border/30">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{log.userEmail || "system"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{log.module}</td>
                  <td className="px-3 py-2 font-medium truncate max-w-[240px]">{log.entityName || "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No activity logged yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
