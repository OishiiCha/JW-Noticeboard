"use client";
import { useScrollLock } from "@/lib/use-scroll-lock";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Loader2, Mail, FileText } from "lucide-react";
import { FileUploadZone } from "@/components/shared/file-upload-zone";
import { AdvancedOptions, type AdvancedOptionsState } from "@/components/shared/advanced-options";
import { useToast } from "@/hooks/use-toast";
import { useModalCloseGuard } from "@/components/shared/modal-close-guard";

interface LetterModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  variant: "letter" | "document";
  categories: { id: string; name: string }[];
}

export function LetterModal({ open, onClose, onSaved, variant, categories }: LetterModalProps) {
  const { toast } = useToast();
  useScrollLock(open);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<AdvancedOptionsState>({
    isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null, isPublished: true,
  });
  const [saving, setSaving] = useState(false);
  const isImageFile = fileUrl && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileUrl);

  const isLetter = variant === "letter";
  const Icon = isLetter ? Mail : FileText;
  const defaultTitle = isLetter ? "Letter" : "Document";
  const categoryName = isLetter ? "Announcements" : "Announcements";

  const handleUpload = useCallback((result: { url: string; fileName: string; type: string }) => {
    setFileUrl(result.url); setFileName(result.fileName); setFileType(result.type);
    if (!title) setTitle(result.fileName.replace(/\.[^.]+$/, ""));
  }, [title]);

  const resetForm = () => {
    setFileUrl(null); setFileName(null); setFileType(""); setTitle(""); setDescription("");
    setOptions({ isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null, isPublished: true });
  };

  const handleSaveDraft = async () => {
    if (!fileUrl && !title && !description) return false;
    const category = categories.find(c => c.name === categoryName);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled draft", description: description || undefined,
          type: "file", fileUrl: fileUrl || undefined, fileName: fileName || undefined,
          thumbnailUrl: fileType.includes("pdf") ? null : fileUrl || undefined,
          isPinned: false, isPublished: false, isPublic: true,
          language: "en", showOnCalendar: false,
          categoryId: category?.id || null,
        }),
      });
      return res.ok;
    } catch { return false; }
  };

  const { backdropProps, requestClose, confirmDialog } = useModalCloseGuard({ open,
    onClose, hasContent: () => !!fileUrl || title.trim() !== "" || description.trim() !== "", onSaveDraft: handleSaveDraft,
  });

  const handleSave = async () => {
    if (!fileUrl || !title) return;
    setSaving(true);
    const category = categories.find(c => c.name === categoryName);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description: description || undefined,
          type: "file", fileUrl, fileName,
          thumbnailUrl: fileType.includes("pdf") ? null : fileUrl,
          isPinned: options.isPinned, isPublished: true, isPublic: true,
          language: "en", showOnCalendar: options.showOnCalendar,
          eventStartDate: options.showOnCalendar ? options.eventStartDate || undefined : undefined,
          eventEndDate: options.showOnCalendar ? options.eventEndDate || undefined : undefined,
          expiresAt: options.expiresAt ? new Date(options.expiresAt).toISOString() : undefined,
          location: options.location || undefined,
          latitude: options.latitude || undefined,
          longitude: options.longitude || undefined,
          categoryId: category?.id || null,
        }),
      });
      if (res.ok) {
        toast({ title: `${defaultTitle} posted` });
        onSaved(); onClose(); resetForm();
      } else {
        toast({ title: "Error saving", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" {...backdropProps}>
      <div className="bg-card border border-border/40 rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-amber-500">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">{isLetter ? "Letter" : "Document / PDF"}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <FileUploadZone
            onUpload={handleUpload}
            onClear={() => { setFileUrl(null); setFileName(null); }}
            fileUrl={fileUrl} fileName={fileName}
            accept={isLetter ? "image/*,application/pdf" : "application/pdf"}
            folder="notices"
          />
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${defaultTitle} title`} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief summary" className="rounded-xl" />
          </div>
          <AdvancedOptions state={options} onChange={setOptions} />
        </div>
        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={requestClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={!fileUrl || !title || saving} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Post {defaultTitle}
          </Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
