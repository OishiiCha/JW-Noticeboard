"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Download,
  Folder,
  HardDrive,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileRecord {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  folder: string;
  uploadedBy: string | null;
  createdAt: string;
}

const FOLDERS = ["all", "notices", "events", "roles", "schedules", "images"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export function FileManager() {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const url = activeFolder === "all" ? "/api/files" : `/api/files?folder=${activeFolder}`;
      const res = await fetch(url);
      if (res.ok) setFiles(await res.json());
    } catch {
      toast({ title: "Error loading files", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeFolder, toast]);

  useEffect(() => {
    setLoading(true);
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/files/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "File deleted" });
        setDeleteId(null);
        fetchFiles();
      }
    } catch {
      toast({ title: "Error deleting file", variant: "destructive" });
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HardDrive className="h-4 w-4" />
          {files.length} files · {formatSize(totalSize)}
        </span>
      </div>

      {/* Folder filter */}
      <div className="flex flex-wrap gap-2">
        {FOLDERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFolder(f)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize ${
              activeFolder === f
                ? "bg-indigo-500 text-white border-indigo-500"
                : "bg-transparent text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            {f === "all" ? "All Files" : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : files.length === 0 ? (
        <Card className="rounded-2xl border-border/40">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No files uploaded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file.id} className="card-hover rounded-2xl border-border/40">
              <CardContent className="flex items-center gap-3 py-3">
                {file.mimeType.startsWith("image/") ? (
                  <img
                    src={`/api/files/${file.id}`}
                    alt={file.originalName}
                    className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border/40"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0 bg-muted/50 border border-border/40">
                    {getFileIcon(file.mimeType)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.originalName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs rounded-md capitalize">{file.folder}</Badge>
                    <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(file.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {file.mimeType.startsWith("image/") && (
                    <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => setPreviewFile(file)}>
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <a href={`/api/files/${file.id}`} download={file.originalName}>
                    <Button variant="ghost" size="icon" className="rounded-lg">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => setDeleteId(file.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(o) => { if (!o) setPreviewFile(null); }}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium truncate">{previewFile?.originalName}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="flex items-center justify-center">
              <img
                src={`/api/files/${previewFile.id}`}
                alt={previewFile.originalName}
                className="max-w-full max-h-[60vh] rounded-xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file. If it's used in a notice or event, the reference will break.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
