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
import { Calendar } from "@/components/ui/calendar";
import { X, Loader2, Paperclip, Star, Trash2, FileText, CalendarPlus, X as XIcon, ChevronDown, ChevronUp } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { FileUploadZone } from "@/components/shared/file-upload-zone";
import { AdvancedOptions, type AdvancedOptionsState } from "@/components/shared/advanced-options";
import { useToast } from "@/hooks/use-toast";
import { useModalCloseGuard } from "@/components/shared/modal-close-guard";

interface MediaModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: { id: string; name: string }[];
  defaultCategoryId?: string | null;
  defaultTitle?: string;
}

interface UploadedFile {
  url: string;
  fileName: string;
  type: string;
}

function isImageFile(file: UploadedFile): boolean {
  const t = file.type || "";
  const n = (file.fileName || file.url || "").toLowerCase();
  return t.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(n);
}

export function MediaModal({
  open,
  onClose,
  onSaved,
  categories,
  defaultCategoryId,
  defaultTitle,
}: MediaModalProps) {
  const { toast } = useToast();
  useScrollLock(open);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || "");
  const [options, setOptions] = useState<AdvancedOptionsState>({
    isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null,
  });
  const [saving, setSaving] = useState(false);
  const [bulkDates, setBulkDates] = useState<string[]>([]);
  const [bulkExpanded, setBulkExpanded] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [rangeMonth, setRangeMonth] = useState<Date>(new Date());

  const resetForm = () => {
    setFiles([]); setTitle(""); setDescription("");
    setCategoryId(defaultCategoryId || "");
    setOptions({ isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null });
    setBulkDates([]);
    setBulkExpanded(false);
    setDateRange(undefined);
  };

  const handleSaveDraft = async () => {
    if (files.length === 0 && !title && !description) return false;
    const images = files.filter(isImageFile);
    const docs = files.filter(f => !isImageFile(f));
    const primary = images[0] || docs[0];
    const gallery = images.slice(1).map(img => img.url).join(",");
    const isImageNotice = images.length > 0;
    try {
      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled draft", description: description || undefined,
          type: isImageNotice ? "image" : "file",
          fileUrl: primary?.url, fileName: primary?.fileName,
          thumbnailUrl: isImageNotice ? primary?.url : null,
          galleryUrls: gallery || undefined,
          isPinned: false, isPublished: false, isPublic: true,
          language: "en", showOnCalendar: false,
          categoryId: categoryId || null,
        }),
      });
      return res.ok;
    } catch { return false; }
  };

  const { backdropProps, requestClose, confirmDialog } = useModalCloseGuard({ open,
    onClose, hasContent: () => files.length > 0 || title.trim() !== "" || description.trim() !== "", onSaveDraft: handleSaveDraft,
  });

  const handleUpload = useCallback((result: { url: string; fileName: string; type: string }) => {
    setFiles(prev => [...prev, { url: result.url, fileName: result.fileName, type: result.type }]);
    if (!title) setTitle(result.fileName.replace(/\.[^.]+$/, ""));
  }, [title]);

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const setPrimary = (idx: number) => {
    setFiles(prev => {
      const item = prev[idx];
      return [item, ...prev.filter((_, i) => i !== idx)];
    });
  };

  const addBulkDate = (date: string) => {
    if (date && !bulkDates.includes(date)) {
      setBulkDates(prev => [...prev, date].sort());
    }
  };

  const removeBulkDate = (date: string) => {
    setBulkDates(prev => prev.filter(d => d !== date));
  };

  const handleSave = async () => {
    if (files.length === 0 || !title) return;
    setSaving(true);
    try {
      const images = files.filter(isImageFile);
      const docs = files.filter(f => !isImageFile(f));
      const primary = images[0] || docs[0];
      const gallery = images.slice(1).map(img => img.url).join(",");
      const isImageNotice = images.length > 0;

      // If bulk dates are set, create a single notice spanning the full range
      let eventStartDate: string | undefined;
      let eventEndDate: string | undefined;
      let postTitle = title;
      let showOnCalendar = options.showOnCalendar;

      if (bulkDates.length > 0) {
        const sortedDates = [...bulkDates].sort();
        eventStartDate = sortedDates[0];
        eventEndDate = sortedDates[sortedDates.length - 1];
        showOnCalendar = true;
        if (sortedDates.length > 1) {
          const startStr = new Date(eventStartDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const endStr = new Date(eventEndDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
          postTitle = `${title} — ${startStr} – ${endStr}`;
        } else {
          postTitle = `${title} — ${eventStartDate}`;
        }
      } else if (options.showOnCalendar) {
        eventStartDate = options.eventStartDate || undefined;
        eventEndDate = options.eventEndDate || undefined;
      }

      const res = await fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: postTitle,
          description: description || undefined,
          type: isImageNotice ? "image" : "file",
          fileUrl: primary.url,
          fileName: primary.fileName,
          thumbnailUrl: isImageNotice ? primary.url : null,
          galleryUrls: gallery || undefined,
          isPinned: options.isPinned,
          isPublished: true,
          isPublic: true,
          language: "en",
          showOnCalendar,
          eventStartDate,
          eventEndDate,
          expiresAt: options.expiresAt ? new Date(options.expiresAt).toISOString() : undefined,
          location: options.location || undefined,
          latitude: options.latitude || undefined,
          longitude: options.longitude || undefined,
          categoryId: categoryId || null,
        }),
      });

      if (!res.ok) {
        toast({ title: "Error saving", variant: "destructive" });
        setSaving(false);
        return;
      }

      // Post additional documents as separate notices
      for (const doc of docs) {
        await fetch("/api/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${title} — ${doc.fileName}`,
            description: description || undefined,
            type: "file",
            fileUrl: doc.url,
            fileName: doc.fileName,
            thumbnailUrl: null,
            isPinned: false,
            isPublished: true,
            isPublic: true,
            language: "en",
            categoryId: categoryId || null,
          }),
        });
      }

      toast({ title: `Posted successfully${bulkDates.length > 0 ? ` (${bulkDates.length} dates)` : ""}` });
      onSaved(); onClose(); resetForm();
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const hasImages = files.some(isImageFile);

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" {...backdropProps}>
      <div className="bg-card border border-border/40 rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-indigo-500">
              <Paperclip className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">Upload Notice</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Upload zone */}
          {files.length === 0 ? (
            <FileUploadZone
              onUpload={handleUpload}
              accept="image/*,application/pdf"
              folder="notices"
              multiple
            />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {files.map((file, idx) => {
                  const isImg = isImageFile(file);
                  return (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-border/40 aspect-square bg-muted/20">
                      {isImg ? (
                        <img src={file.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-1 p-2">
                          <FileText className="h-6 w-6 text-rose-500" />
                          <p className="text-[10px] text-muted-foreground truncate w-full text-center">{file.fileName}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        {isImg && idx !== 0 && (
                          <button onClick={() => setPrimary(idx)} className="bg-white/80 rounded p-1" title="Set as primary">
                            <Star className="h-3 w-3" />
                          </button>
                        )}
                        <button onClick={() => removeFile(idx)} className="bg-white/80 rounded p-1" title="Remove">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {idx === 0 && isImg && (
                        <div className="absolute top-1 left-1 bg-indigo-500 text-white text-[8px] px-1.5 py-0.5 rounded">PRIMARY</div>
                      )}
                    </div>
                  );
                })}
                <label className="border-2 border-dashed border-border/60 rounded-lg flex items-center justify-center aspect-square cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                  <input type="file" className="hidden" accept="image/*,application/pdf" multiple onChange={async (e) => {
                    if (e.target.files) {
                      for (let i = 0; i < e.target.files.length; i++) {
                        const file = e.target.files[i];
                        const formData = new FormData();
                        formData.append("file", file);
                        formData.append("folder", "notices");
                        const res = await fetch("/api/upload", { method: "POST", body: formData });
                        if (res.ok) {
                          const data = await res.json();
                          setFiles(prev => [...prev, { url: data.url, fileName: data.fileName, type: data.type }]);
                        }
                      }
                    }
                    e.target.value = "";
                  }} />
                  <span className="text-2xl text-muted-foreground">+</span>
                </label>
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle || "Notice title"} className="rounded-xl" />
          </div>

          {/* Category selector */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief summary or caption" className="rounded-xl" />
          </div>

          {/* Bulk date selection */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setBulkExpanded(!bulkExpanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {bulkExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <CalendarPlus className="h-3.5 w-3.5" />
              Link to multiple dates (optional)
            </button>
            {bulkExpanded && (
              <div className="space-y-3 rounded-xl border border-border/40 p-3 bg-muted/10">
                {bulkDates.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {bulkDates.map(date => (
                        <span key={date} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-xs px-2 py-1 rounded-lg">
                          {date}
                          <button onClick={() => removeBulkDate(date)} className="hover:text-red-500">
                            <XIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Will create 1 notice spanning {bulkDates[0]} to {bulkDates[bulkDates.length - 1]}.
                    </p>
                  </div>
                )}

                {/* Range calendar — select start then end like airline booking */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {dateRange?.from && dateRange?.to
                      ? `${dateRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} → ${dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1} days)`
                      : dateRange?.from
                      ? `${dateRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — click end date`
                      : "Click a start date, then an end date"}
                  </p>
                  <div className="flex justify-center rounded-lg border border-border/40 p-1 bg-background">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      month={rangeMonth}
                      onMonthChange={setRangeMonth}
                      numberOfMonths={1}
                      className="scale-90 origin-top"
                    />
                  </div>

                  {/* Quick select buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        for (let i = 0; i < 4; i++) {
                          const d = new Date(today);
                          d.setDate(d.getDate() + i * 7);
                          addBulkDate(d.toISOString().split("T")[0]);
                        }
                      }}
                      className="rounded-lg text-xs"
                    >
                      +4 weeks
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const first = new Date(now.getFullYear(), now.getMonth(), 1);
                        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
                          addBulkDate(d.toISOString().split("T")[0]);
                        }
                      }}
                      className="rounded-lg text-xs"
                    >
                      Full month
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!dateRange?.from || !dateRange?.to}
                      onClick={() => {
                        if (!dateRange?.from || !dateRange?.to) return;
                        const start = new Date(dateRange.from);
                        const end = new Date(dateRange.to);
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                          addBulkDate(d.toISOString().split("T")[0]);
                        }
                      }}
                      className="rounded-lg text-xs"
                    >
                      Add range to dates
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setDateRange(undefined); setBulkDates([]); }}
                      className="rounded-lg text-xs"
                    >
                      Clear all
                    </Button>
                  </div>
                </div>

                {/* Manual single date add */}
                <div className="flex gap-2 pt-1 border-t border-border/30">
                  <Input
                    type="date"
                    onChange={(e) => { if (e.target.value) addBulkDate(e.target.value); e.target.value = ""; }}
                    className="rounded-lg text-sm flex-1"
                  />
                </div>
              </div>
            )}
          </div>

          <AdvancedOptions state={options} onChange={setOptions} />
        </div>
        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={requestClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={files.length === 0 || !title || saving} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Post{bulkDates.length > 0 ? ` (${bulkDates.length} dates)` : ""}
          </Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
