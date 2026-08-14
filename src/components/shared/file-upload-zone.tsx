"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, X, FileText, Image as ImageIcon, AlertTriangle } from "lucide-react";

interface FileUploadZoneProps {
  onUpload: (result: { url: string; fileName: string; type: string }) => void;
  onClear?: () => void;
  fileUrl?: string | null;
  fileName?: string | null;
  accept?: string;
  folder?: string;
  multiple?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function FileUploadZone({
  onUpload,
  onClear,
  fileUrl,
  fileName,
  accept = "image/*,application/pdf",
  folder = "notices",
  multiple = false,
  disabled = false,
  compact = false,
}: FileUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isImage = (url: string, name?: string | null) => {
    const n = (name || url || "").toLowerCase();
    return /\.(jpe?g|png|webp|gif|bmp)$/i.test(n) || n.startsWith("data:image");
  };

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        onUpload({ url: data.url, fileName: data.fileName, type: data.type });
      }
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  }, [folder, onUpload]);

  const handleFiles = useCallback(async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      await handleFile(files[i]);
    }
  }, [handleFile]);

  if (fileUrl) {
    if (isImage(fileUrl, fileName)) {
      return (
        <div className="relative rounded-xl overflow-hidden border border-border/40 group">
          <img src={fileUrl} alt="Preview" className={`w-full object-contain ${compact ? "max-h-40" : "max-h-64"} bg-muted/10`} />
          {confirmClear ? (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-10">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <p className="text-xs text-white text-center px-4">Remove this image?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onClear?.(); setConfirmClear(false); }}
                  className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600"
                >
                  Remove
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1 rounded-lg bg-white/20 text-white text-xs font-medium hover:bg-white/30"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3">
        <div className="h-10 w-10 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName || "File"}</p>
        </div>
        {confirmClear ? (
          <div className="flex items-center gap-1.5">
            <button onClick={() => { onClear?.(); setConfirmClear(false); }} className="text-xs font-medium text-red-500 hover:text-red-600">Remove</button>
            <button onClick={() => setConfirmClear(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmClear(true)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading || disabled}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={`w-full rounded-xl border-2 border-dashed transition-colors text-center ${
          dragOver
            ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
            : "border-border/60 hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10"
        } ${compact ? "p-4" : "p-6"}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className={`${compact ? "h-5 w-5" : "h-6 w-6"} text-muted-foreground`} />
            <p className={`${compact ? "text-xs" : "text-sm"} font-medium`}>
              {dragOver ? "Drop file here" : "Drag & drop or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              {accept.includes("pdf") ? "PDF or Image" : "Images only"}
              {multiple ? " — multiple files supported" : ""}
            </p>
          </div>
        )}
      </button>
    </>
  );
}
