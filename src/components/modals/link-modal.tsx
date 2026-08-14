"use client";
import { useScrollLock } from "@/lib/use-scroll-lock";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Loader2, Link2, Search } from "lucide-react";
import { AdvancedOptions, type AdvancedOptionsState } from "@/components/shared/advanced-options";
import { useToast } from "@/hooks/use-toast";
import { useModalCloseGuard } from "@/components/shared/modal-close-guard";

interface LinkModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: { id: string; name: string }[];
  defaultCategoryId?: string | null;
}

interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain?: string;
}

export function LinkModal({ open, onClose, onSaved, categories, defaultCategoryId }: LinkModalProps) {
  const { toast } = useToast();
  useScrollLock(open);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || "");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [options, setOptions] = useState<AdvancedOptionsState>({
    isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null,
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setUrl(""); setTitle(""); setDescription(""); setButtonLabel(""); setPreview(null);
    setCategoryId(defaultCategoryId || "");
    setOptions({ isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null });
  };

  const fetchPreview = useCallback(async (targetUrl: string) => {
    if (!targetUrl) return;
    setFetchingPreview(true);
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(targetUrl)}`);
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
        if (data.title && !title) setTitle(data.title);
        if (data.description && !description) setDescription(data.description);
      }
    } catch {
      // silent fail
    } finally {
      setFetchingPreview(false);
    }
  }, [title, description]);

  const handleSave = async () => {
    if (!url || !title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description: description || undefined,
          type: "link", content: url, linkUrl: url,
          linkLabel: buttonLabel || undefined,
          linkIcon: preview?.favicon || undefined,
          thumbnailUrl: preview?.image || undefined,
          isPinned: options.isPinned, isPublished: true, isPublic: true,
          language: "en", showOnCalendar: options.showOnCalendar,
          eventStartDate: options.showOnCalendar ? options.eventStartDate || undefined : undefined,
          eventEndDate: options.showOnCalendar ? options.eventEndDate || undefined : undefined,
          expiresAt: options.expiresAt ? new Date(options.expiresAt).toISOString() : undefined,
          location: options.location || undefined,
          latitude: options.latitude || undefined,
          longitude: options.longitude || undefined,
          categoryId: categoryId || null,
        }),
      });
      if (res.ok) {
        toast({ title: "Link posted" });
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

  const { backdropProps, requestClose, confirmDialog } = useModalCloseGuard({ open,
    onClose, hasContent: () => url.trim() !== "" || title.trim() !== "" || description.trim() !== "",
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" {...backdropProps}>
      <div className="bg-card border border-border/40 rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-cyan-500">
              <Link2 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">Add Link</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>URL</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                className="rounded-xl"
                onBlur={(e) => fetchPreview(e.target.value)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPreview(url)}
                disabled={!url || fetchingPreview}
                className="rounded-xl shrink-0"
              >
                {fetchingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {preview && (preview.image || preview.title || preview.favicon) && (
            <div className="rounded-xl border border-border/40 overflow-hidden">
              {preview.image && (
                <img src={preview.image} alt="" className="w-full max-h-40 object-cover" />
              )}
              <div className="p-3 flex items-center gap-2">
                {preview.favicon && (
                  <img src={preview.favicon} alt="" className="h-5 w-5 rounded shrink-0" />
                )}
                <div className="min-w-0">
                  {preview.title && <p className="text-sm font-medium truncate">{preview.title}</p>}
                  {preview.domain && <p className="text-xs text-muted-foreground truncate">{preview.domain}</p>}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Link title" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Button label (optional)</Label>
            <Input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} placeholder="e.g. Read on jw.org" className="rounded-xl" />
          </div>

          {/* Category / Section selector */}
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
            <p className="text-xs text-muted-foreground">
              Links with no category appear as clickable buttons in the Quick Links section.
            </p>
          </div>

          <AdvancedOptions state={options} onChange={setOptions} showCalendar={false} />
        </div>
        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={requestClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={!url || !title || saving} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Add Link
          </Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
