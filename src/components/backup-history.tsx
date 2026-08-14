"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, History, RotateCcw, Trash2, Download, Loader2, ShieldAlert, Archive, Upload } from "lucide-react";

interface BackupLog {
  id: string;
  filename: string;
  size: number;
  type: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
}

interface ActionLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  module: string;
  entityId: string | null;
  entityName: string | null;
  details: string | null;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500",
  update: "bg-blue-500",
  delete: "bg-red-500",
  backup: "bg-purple-500",
  restore: "bg-amber-500",
  login: "bg-gray-500",
  logout: "bg-gray-400",
};

const MODULE_LABELS: Record<string, string> = {
  notices: "Notices",
  events: "Events",
  meetings: "Meetings",
  settings: "Settings",
  users: "Users",
  files: "Files",
  roles: "Roles",
  backup: "Backup",
};

export function BackupHistory() {
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [backupRes, logRes] = await Promise.all([
        fetch("/api/backup"),
        fetch("/api/action-logs?limit=100"),
      ]);
      if (backupRes.ok) {
        const data = await backupRes.json();
        setBackups(data.logs || []);
      }
      if (logRes.ok) {
        const data = await logRes.json();
        setLogs(data.logs || []);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createBackup = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        setError("Failed to create backup");
      }
    } catch {
      setError("Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    setRestoring(backupId);
    setError(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", backupId }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to restore backup");
      }
    } catch {
      setError("Failed to restore backup");
    } finally {
      setRestoring(null);
      setRestoreConfirm(null);
    }
  };

  const deleteBackup = async (backupId: string) => {
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", backupId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      setError("Failed to delete backup");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const [exporting, setExporting] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [downloadingBackupId, setDownloadingBackupId] = useState<string | null>(null);
  const [uploadingRestore, setUploadingRestore] = useState(false);
  const [restoreUploadConfirm, setRestoreUploadConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.split('filename="')[1]?.replace(/"$/, "") || `noticeboard_export_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export notices");
    } finally {
      setExporting(false);
    }
  }, []);

  const handleDownloadBackup = useCallback(async () => {
    setDownloadingBackup(true);
    setError(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download" }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.split('filename="')[1]?.replace(/"$/, "") || `noticeboard_backup_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download backup");
    } finally {
      setDownloadingBackup(false);
    }
  }, []);

  const handleDownloadBackupFile = useCallback(async (backupId: string, filename: string) => {
    setDownloadingBackupId(backupId);
    setError(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download-file", backupId }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download backup file");
    } finally {
      setDownloadingBackupId(null);
    }
  }, []);

  const handleRestoreUpload = useCallback(async (file: File) => {
    setUploadingRestore(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/backup", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to restore backup");
      }
    } catch {
      setError("Failed to restore backup");
    } finally {
      setUploadingRestore(false);
      setRestoreUploadConfirm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backup Section */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Data Backups</CardTitle>
                <p className="text-xs text-muted-foreground">Daily automatic backups at 2:00 AM. Manual backups available on demand.</p>
              </div>
            </div>
            <Button onClick={createBackup} disabled={creating} size="sm" className="rounded-lg">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
              {creating ? "Creating..." : "Backup Now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No backups yet. Click &quot;Backup Now&quot; to create one.</p>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div key={backup.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple-500/10 shrink-0">
                    <Database className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{backup.filename}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(backup.createdAt)}</span>
                      <span>·</span>
                      <span>{formatBytes(backup.size)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">
                        {backup.type === "scheduled" ? "Auto" : "Manual"}
                      </Badge>
                      {backup.createdBy && <span>· by {backup.createdBy}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {restoreConfirm === backup.id ? (
                      <>
                        <Button size="sm" variant="destructive" className="h-7 text-xs rounded-lg" onClick={() => restoreBackup(backup.id)} disabled={restoring === backup.id}>
                          {restoring === backup.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => setRestoreConfirm(null)}>Cancel</Button>
                      </>
                    ) : deleteConfirm === backup.id ? (
                      <>
                        <Button size="sm" variant="destructive" className="h-7 text-xs rounded-lg" onClick={() => deleteBackup(backup.id)}>Delete</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => handleDownloadBackupFile(backup.id, backup.filename)} disabled={downloadingBackupId === backup.id}>
                          {downloadingBackupId === backup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => setRestoreConfirm(backup.id)}>
                          <RotateCcw className="h-3 w-3 mr-1" />Restore
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => setDeleteConfirm(backup.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Export Notices (ZIP)</CardTitle>
                <p className="text-xs text-muted-foreground">Download all notices as text files with attachments in a single ZIP archive.</p>
              </div>
            </div>
            <Button onClick={handleExport} disabled={exporting} size="sm" className="rounded-lg">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
              {exporting ? "Exporting..." : "Export ZIP"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Full Backup Download / Restore Section */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Full Backup &amp; Restore</CardTitle>
                <p className="text-xs text-muted-foreground">Download a complete backup (database + uploaded files) or restore from a ZIP file.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleDownloadBackup} disabled={downloadingBackup} size="sm" className="rounded-lg">
                {downloadingBackup ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                {downloadingBackup ? "Creating..." : "Download Backup ZIP"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (restoreUploadConfirm) {
                      handleRestoreUpload(f);
                    } else {
                      setRestoreUploadConfirm(true);
                    }
                  }
                }}
              />
              {restoreUploadConfirm ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingRestore}
                  >
                    {uploadingRestore ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    {uploadingRestore ? "Restoring..." : "Confirm Restore"}
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => { setRestoreUploadConfirm(false); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingRestore}
                >
                  {uploadingRestore ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
                  {uploadingRestore ? "Restoring..." : "Restore from ZIP"}
                </Button>
              )}
            </div>
          </div>
          {restoreUploadConfirm && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Warning: Restoring will overwrite all current data. Click &quot;Confirm Restore&quot; and select the ZIP file again to proceed.
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Action History Section */}
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Action History</CardTitle>
              <p className="text-xs text-muted-foreground">Recent actions by all users — creates, updates, deletes, and more.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No actions logged yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/20 transition-colors">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${ACTION_COLORS[log.action] || "bg-gray-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{log.action}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">
                        {MODULE_LABELS[log.module] || log.module}
                      </Badge>
                      {log.entityName && (
                        <span className="text-xs text-muted-foreground truncate">· {log.entityName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{log.userEmail || "System"}</span>
                      {log.userRole && <Badge variant="outline" className="text-[9px] px-1 py-0 rounded-md">{log.userRole}</Badge>}
                      <span>·</span>
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
