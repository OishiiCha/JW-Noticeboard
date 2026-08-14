"use client";
import { useScrollLock } from "@/lib/use-scroll-lock";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Camera, Star, Trash2 } from "lucide-react";
import { FileUploadZone } from "@/components/shared/file-upload-zone";
import { AdvancedOptions, type AdvancedOptionsState } from "@/components/shared/advanced-options";
import { useToast } from "@/hooks/use-toast";
import { useModalCloseGuard } from "@/components/shared/modal-close-guard";

interface PhotoModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: { id: string; name: string }[];
}

interface UploadedImage {
  url: string;
  fileName: string;
}

export function PhotoModal({ open, onClose, onSaved, categories }: PhotoModalProps) {
  const { toast } = useToast();
  useScrollLock(open);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [options, setOptions] = useState<AdvancedOptionsState>({
    isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null,
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setImages([]); setTitle(""); setCaption("");
    setOptions({ isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null });
  };

  const handleSaveDraft = async () => {
    if (images.length === 0 && !title && !caption) return false;
    const category = categories.find(c => c.name === "Announcements");
    const primary = images[0];
    const gallery = images.slice(1).map(img => img.url).join(",");
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled draft", description: caption || undefined,
          type: "image", fileUrl: primary?.url, fileName: primary?.fileName,
          thumbnailUrl: primary?.url, galleryUrls: gallery || undefined,
          isPinned: false, isPublished: false, isPublic: true,
          language: "en", showOnCalendar: false,
          categoryId: category?.id || null,
        }),
      });
      return res.ok;
    } catch { return false; }
  };

  const { backdropProps, requestClose, confirmDialog } = useModalCloseGuard({ open,
    onClose, hasContent: () => images.length > 0 || title.trim() !== "" || caption.trim() !== "", onSaveDraft: handleSaveDraft,
  });

  const handleUpload = useCallback((result: { url: string; fileName: string; type: string }) => {
    setImages(prev => [...prev, { url: result.url, fileName: result.fileName }]);
  }, []);

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const setPrimary = (idx: number) => {
    setImages(prev => {
      const item = prev[idx];
      return [item, ...prev.filter((_, i) => i !== idx)];
    });
  };

  const handleSave = async () => {
    if (images.length === 0 || !title) return;
    setSaving(true);
    const category = categories.find(c => c.name === "Announcements");
    const primary = images[0];
    const gallery = images.slice(1).map(img => img.url).join(",");
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description: caption || undefined,
          type: "image", fileUrl: primary.url, fileName: primary.fileName,
          thumbnailUrl: primary.url, galleryUrls: gallery || undefined,
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
        toast({ title: "Photo posted" });
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
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-green-500">
              <Camera className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">Photo / Image</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {images.length === 0 ? (
            <FileUploadZone onUpload={handleUpload} accept="image/*" folder="images" multiple />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-border/40 aspect-square">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      {idx !== 0 && (
                        <button onClick={() => setPrimary(idx)} className="bg-white/80 rounded p-1" title="Set as primary">
                          <Star className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => removeImage(idx)} className="bg-white/80 rounded p-1" title="Remove">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {idx === 0 && (
                      <div className="absolute top-1 left-1 bg-indigo-500 text-white text-[8px] px-1.5 py-0.5 rounded">PRIMARY</div>
                    )}
                  </div>
                ))}
                <label className="border-2 border-dashed border-border/60 rounded-lg flex items-center justify-center aspect-square cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                  <input type="file" className="hidden" accept="image/*" multiple onChange={async (e) => {
                    if (e.target.files) {
                      for (let i = 0; i < e.target.files.length; i++) {
                        const file = e.target.files[i];
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("folder", "images");
                        const res = await fetch("/api/upload", { method: "POST", body: formData });
                        if (res.ok) {
                          const data = await res.json();
                          setImages(prev => [...prev, { url: data.url, fileName: data.fileName }]);
                        }
                      }
                    }
                    e.target.value = "";
                  }} />
                  <span className="text-2xl text-muted-foreground">+</span>
                </label>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Photo title" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Caption (optional)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Short description" className="rounded-xl" />
          </div>

          <AdvancedOptions state={options} onChange={setOptions} />
        </div>
        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={requestClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={images.length === 0 || !title || saving} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Upload & Post
          </Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
