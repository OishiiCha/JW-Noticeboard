"use client";
import { useScrollLock } from "@/lib/use-scroll-lock";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Loader2, Link2, Search, Upload, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EditLinkModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  notice: {
    id: string;
    title: string;
    description?: string | null;
    linkUrl?: string | null;
    linkLabel?: string | null;
    linkIcon?: string | null;
    categoryId?: string | null;
    isPinned?: boolean;
    expiresAt?: string | null;
  } | null;
  categories: { id: string; name: string }[];
}

export function EditLinkModal({ open, onClose, onSaved, notice, categories }: EditLinkModalProps) {
  const { toast } = useToast();
  useScrollLock(open);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [fetchingFavicon, setFetchingFavicon] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const syncFromNotice = useCallback(() => {
    if (!notice) return;
    setTitle(notice.title || "");
    setDescription(notice.description || "");
    setUrl(notice.linkUrl || "");
    setLabel(notice.linkLabel || "");
    setIconUrl(notice.linkIcon || "");
    setCategoryId(notice.categoryId || "");
    setIsPinned(notice.isPinned || false);
    const hasExp = !!notice.expiresAt;
    setHasExpiry(hasExp);
    setExpiresAt(hasExp && notice.expiresAt ? new Date(notice.expiresAt).toISOString().split("T")[0] : "");
  }, [notice]);

  // Sync state when notice changes / modal opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    syncFromNotice();
  }
  if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const handleFetchFavicon = async () => {
    if (!url) return;
    setFetchingFavicon(true);
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.favicon) setIconUrl(data.favicon);
        if (data.title && !title) setTitle(data.title);
      }
    } catch {
      // silent
    } finally {
      setFetchingFavicon(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "link-icons");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setIconUrl(data.url);
      }
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!notice || !title) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          linkUrl: url || null,
          linkLabel: label || null,
          linkIcon: iconUrl || null,
          categoryId: categoryId || null,
          isPinned,
          expiresAt: hasExpiry && expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      if (res.ok) {
        toast({ title: "Link updated" });
        onSaved();
        onClose();
      } else {
        toast({ title: "Error saving", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open || !notice) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border/40 rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-cyan-500">
              <Link2 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">Edit Link</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* URL */}
          <div className="space-y-1.5">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="rounded-xl" />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Link title" className="rounded-xl" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="rounded-xl" />
          </div>

          {/* Button label */}
          <div className="space-y-1.5">
            <Label>Button label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Read on jw.org" className="rounded-xl" />
          </div>

          {/* Link icon — favicon fetch + custom image upload */}
          <div className="space-y-2">
            <Label>Link icon</Label>
            <div className="flex items-center gap-3">
              {iconUrl ? (
                <div className="relative group">
                  <img src={iconUrl} alt="Icon" className="h-12 w-12 rounded-xl border border-border/40 object-cover" />
                  <button
                    onClick={() => setIconUrl("")}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-12 w-12 rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <Input
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder="Icon URL or fetch/upload..."
                  className="rounded-xl text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchFavicon}
                    disabled={!url || fetchingFavicon}
                    className="rounded-lg text-xs"
                  >
                    {fetchingFavicon ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Search className="h-3.5 w-3.5 mr-1" />}
                    Fetch favicon
                  </Button>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload image
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section / Category */}
          <div className="space-y-1.5">
            <Label>Show in section</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Quick Links (no category)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Quick Links (no category)</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pin + Expiry */}
          <div className="space-y-3 rounded-xl border border-border/40 p-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <Label className="text-sm cursor-pointer">Pin to top</Label>
              <Switch checked={isPinned} onCheckedChange={setIsPinned} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm cursor-pointer">Expiry date</Label>
                <Switch
                  checked={hasExpiry}
                  onCheckedChange={(v) => {
                    setHasExpiry(v);
                    if (v && !expiresAt) setExpiresAt(new Date().toISOString().split("T")[0]);
                  }}
                />
              </div>
              {hasExpiry && (
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="rounded-lg text-sm"
                />
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={!title || saving} className="bg-cyan-600 hover:bg-cyan-700 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save Link
          </Button>
        </div>
      </div>
    </div>
  );
}
