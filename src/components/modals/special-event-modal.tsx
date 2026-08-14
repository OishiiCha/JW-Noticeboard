"use client";
import { useScrollLock } from "@/lib/use-scroll-lock";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Loader2, CalendarPlus, MapPin } from "lucide-react";
import { FileUploadZone } from "@/components/shared/file-upload-zone";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { useToast } from "@/hooks/use-toast";
import { useModalCloseGuard } from "@/components/shared/modal-close-guard";

interface SavedLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SpecialEventModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editEventId?: string | null;
}

const EVENT_TYPES = [
  { value: "convention", label: "Convention" },
  { value: "co_visit", label: "Circuit Overseer Visit" },
  { value: "assembly", label: "Assembly" },
  { value: "memorial", label: "Memorial" },
  { value: "other", label: "Other" },
];

// Auto-assign colors based on event type — matches calendar EVENT_TYPE_COLORS dots
const TYPE_COLOR_MAP: Record<string, string> = {
  convention: "bg-blue-500",
  assembly: "bg-green-500",
  co_visit: "bg-purple-500",
  memorial: "bg-rose-500",
  other: "bg-slate-500",
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseDateFromText(text: string): string | null {
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const monthDayMatch = text.match(/(\w+)\s+(\d{1,2})/);
  if (monthDayMatch) {
    const monthStr = monthDayMatch[1];
    const day = parseInt(monthDayMatch[2], 10);
    const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase().startsWith(monthStr.toLowerCase().slice(0, 3)));
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const day = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

export function SpecialEventModal({ open, onClose, onSaved, editEventId }: SpecialEventModalProps) {
  const { toast } = useToast();
  useScrollLock(open);
  const [eventType, setEventType] = useState("convention");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [showOnNoticeboard, setShowOnNoticeboard] = useState(true);
  const [overrideConvention, setOverrideConvention] = useState(false);
  const [cancelMidweek, setCancelMidweek] = useState(false);
  const [cancelWeekend, setCancelWeekend] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [meetingDays, setMeetingDays] = useState<{ midweek: number; weekend: number }>({ midweek: 2, weekend: 6 });
  const isEditing = !!editEventId;

  useEffect(() => {
    if (open) {
      fetch("/api/saved-locations").then(res => res.ok ? res.json() : []).then(setSavedLocations).catch(() => {});
      fetch("/api/settings").then(res => res.ok ? res.json() : {}).then((data: Record<string, unknown>) => {
        if (data.conventionStartDay !== undefined || data.conventionEndDay !== undefined) {
          setConventionDays({
            start: data.conventionStartDay !== undefined ? Number(data.conventionStartDay) : 5,
            end: data.conventionEndDay !== undefined ? Number(data.conventionEndDay) : 0,
          });
        }
        setMeetingDays({
          midweek: data.midweekDay !== undefined ? Number(data.midweekDay) : 2,
          weekend: data.weekendDay !== undefined ? Number(data.weekendDay) : 6,
        });
      }).catch(() => {});
      if (editEventId) {
        fetch(`/api/events/${editEventId}`).then(res => res.ok ? res.json() : null).then((data) => {
          if (data) {
            setEventType(data.type || "convention");
            setTitle(data.title || "");
            setDescription(data.description || "");
            setStartDate(data.startDate || "");
            setEndDate(data.endDate || "");
            setLocation(data.location || "");
            setImageUrl(data.imageUrl || null);
            setImageFileName(null);
            setShowOnNoticeboard(data.showOnNoticeboard !== false);
          }
        }).catch(() => {});
      } else {
        setEventType("convention"); setTitle(""); setDescription("");
        setStartDate(""); setEndDate(""); setLocation("");
        setImageUrl(null); setImageFileName(null);
        setShowOnNoticeboard(true);
        setOverrideConvention(false);
        setCancelMidweek(false);
        setCancelWeekend(false);
      }
    }
  }, [open, editEventId]);

  const [conventionDays, setConventionDays] = useState<{ start: number; end: number }>({ start: 5, end: 0 });

  // Calculate auto-end days for convention/assembly
  const isConventionType = eventType === "convention" || eventType === "assembly";
  const autoEndDays = isConventionType && !overrideConvention
    ? (conventionDays.end - conventionDays.start + 7) % 7
    : null;

  const prefillConventionDates = () => {
    const today = new Date();
    const { start: startDay, end: endDay } = conventionDays;
    // Find next occurrence of startDay
    const startDate = new Date(today);
    const curDay = startDate.getDay();
    let diff = (startDay - curDay + 7) % 7;
    if (diff === 0 && startDay !== curDay) diff = 7;
    startDate.setDate(startDate.getDate() + diff);
    const startYMD = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
    // End day: if endDay >= startDay, same week. If endDay < startDay, next week.
    const endDate = new Date(startDate);
    let endDiff = (endDay - startDay + 7) % 7;
    endDate.setDate(endDate.getDate() + endDiff);
    const endYMD = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    setStartDate(startYMD);
    setEndDate(endYMD);
  };

  const resetForm = () => {
    setEventType("convention"); setTitle(""); setDescription("");
    setStartDate(""); setEndDate(""); setLocation("");
    setImageUrl(null); setImageFileName(null);
    setShowOnNoticeboard(true);
    setOverrideConvention(false);
    setCancelMidweek(false);
    setCancelWeekend(false);
  };

  const handleSaveDraft = async () => {
    if (!title && !description && !startDate && !imageUrl) return false;
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled draft", description: description || undefined,
          type: eventType, startDate: startDate || new Date().toISOString().split("T")[0], endDate: endDate || undefined,
          location: location || undefined, imageUrl: imageUrl || undefined,
          color: TYPE_COLOR_MAP[eventType] || "bg-slate-500", showOnNoticeboard: false,
        }),
      });
      return res.ok;
    } catch { return false; }
  };

  const { backdropProps, requestClose, confirmDialog } = useModalCloseGuard({ open,
    onClose, hasContent: () => title.trim() !== "" || description.trim() !== "" || !!startDate || !!imageUrl, onSaveDraft: handleSaveDraft,
  });

  const handleUpload = useCallback((result: { url: string; fileName: string; type: string }) => {
    setImageUrl(result.url); setImageFileName(result.fileName);
  }, []);

  const handleSave = async () => {
    if (!title || !startDate) return;
    setSaving(true);
    try {
      const url = isEditing ? `/api/events/${editEventId}` : "/api/events";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description: description || undefined,
          type: eventType, startDate, endDate: endDate || undefined,
          location: location || undefined,
          imageUrl: imageUrl || undefined,
          color: TYPE_COLOR_MAP[eventType] || "bg-slate-500", showOnNoticeboard,
        }),
      });
      if (res.ok) {
        // Create meeting overrides for cancelled meetings during event date range
        if ((cancelMidweek || cancelWeekend) && startDate) {
          const end = endDate || startDate;
          const cursor = new Date(startDate + "T00:00:00");
          const endDt = new Date(end + "T00:00:00");
          const cancelReason = `${title} — ${new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}${end !== startDate ? `–${new Date(end + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}`;
          while (cursor <= endDt) {
            const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
            const dow = cursor.getDay();
            if (cancelMidweek && dow === meetingDays.midweek) {
              await fetch("/api/meeting-overrides", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: dateStr, meetingType: "midweek", isCancelled: true, reason: cancelReason, createNotice: true }),
              });
            }
            if (cancelWeekend && dow === meetingDays.weekend) {
              await fetch("/api/meeting-overrides", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: dateStr, meetingType: "weekend", isCancelled: true, reason: cancelReason, createNotice: true }),
              });
            }
            cursor.setDate(cursor.getDate() + 1);
          }
        }
        toast({ title: isEditing ? "Event updated" : "Event created" });
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
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-rose-500">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">{isEditing ? "Edit Event" : "Special Event"}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={requestClose} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={(v) => { setEventType(v); setOverrideConvention(false); }}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-xl" />
          </div>
          {/* Date Range Picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Date Range</Label>
              {isConventionType && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={overrideConvention}
                    onChange={(e) => setOverrideConvention(e.target.checked)}
                    className="rounded accent-indigo-500"
                  />
                  Custom end date
                </label>
              )}
            </div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
              autoEndDays={autoEndDays}
              overrideAuto={overrideConvention}
            />
            {isConventionType && !overrideConvention && (
              <p className="text-[11px] text-muted-foreground">
                Click the start date — end date auto-fills to {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][conventionDays.end]} ({autoEndDays} days). Toggle "Custom end date" to override.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Location (optional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Event location" className="rounded-xl" />
            {savedLocations.length > 0 && (
              <Select value="" onValueChange={(v) => {
                const loc = savedLocations.find(l => l.id === v);
                if (loc) setLocation(loc.name + (loc.address ? `, ${loc.address}` : ""));
              }}>
                <SelectTrigger className="rounded-xl text-xs h-8 mt-1"><span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3 w-3" /> Use saved location</span></SelectTrigger>
                <SelectContent>
                  {savedLocations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <FileUploadZone
            onUpload={handleUpload}
            onClear={() => { setImageUrl(null); setImageFileName(null); }}
            fileUrl={imageUrl} fileName={imageFileName}
            accept="image/*"
            folder="events"
            compact
          />
          {startDate && (
            <div className="space-y-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Cancel meetings during this event</p>
              <p className="text-[11px] text-muted-foreground">Creates cancellation notices on the noticeboard for affected meeting days.</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={cancelMidweek} onChange={(e) => setCancelMidweek(e.target.checked)} className="rounded accent-amber-500" />
                Cancel Midweek Meetings
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={cancelWeekend} onChange={(e) => setCancelWeekend(e.target.checked)} className="rounded accent-amber-500" />
                Cancel Weekend Meetings
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showOnNoticeboard} onChange={(e) => setShowOnNoticeboard(e.target.checked)} className="rounded accent-rose-500" />
            Show on calendar
          </label>
        </div>
        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={requestClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={!title || !startDate || saving} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save Event
          </Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
