"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { CalendarX, AlertCircle, RotateCcw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Plus,
  Trash2,
  Edit,
  CalendarRange,
  MapPin,
  Upload,
  Loader2,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
const LocationPicker = dynamic(() => import("@/components/location-picker").then(m => m.LocationPicker), { ssr: false });

interface SpecialEvent {
  id: string;
  title: string;
  titleTl?: string | null;
  type: string;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  imageUrl?: string | null;
  color?: string | null;
  showOnNoticeboard: boolean;
  createdAt: string;
}

const EVENT_COLORS = [
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-amber-500", label: "Amber" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-pink-500", label: "Pink" },
];

export function EventManager({ language }: { language: Language }) {
  const { toast } = useToast();
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<SpecialEvent> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cancelMeetingsData, setCancelMeetingsData] = useState<{ title: string; startDate: string; endDate: string } | null>(null);
  const [cancellingMeetings, setCancellingMeetings] = useState(false);
  const [eventOverrides, setEventOverrides] = useState<{ id: string; date: string; meetingType: string; isCancelled: boolean; reason: string | null }[]>([]);
  const [manageMeetingsBusy, setManageMeetingsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) setEvents(await res.json());
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    setEditing({
      title: "",
      type: "other",
      startDate: "",
      showOnNoticeboard: true,
      color: "bg-blue-500",
    });
    setEditOpen(true);
  };

  const handleCreateConvention = async () => {
    // Fetch convention default days from settings
    let startDay = 5; // Friday
    let endDay = 0; // Sunday
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.conventionStartDay !== undefined) startDay = parseInt(String(data.conventionStartDay), 10);
        if (data.conventionEndDay !== undefined) endDay = parseInt(String(data.conventionEndDay), 10);
      }
    } catch {}

    // Find the next occurrence of the start day
    const today = new Date();
    const startDate = new Date(today);
    while (startDate.getDay() !== startDay) {
      startDate.setDate(startDate.getDate() + 1);
    }
    const endDate = new Date(startDate);
    // Calculate days until end day (may wrap around week)
    let daysToAdd = (endDay - startDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 2; // Default to 2 days if same day
    endDate.setDate(endDate.getDate() + daysToAdd);

    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    setEditing({
      title: "",
      type: "convention",
      startDate: fmt(startDate),
      endDate: fmt(endDate),
      showOnNoticeboard: true,
      color: "bg-green-500",
    });
    setEditOpen(true);
  };

  const handleEdit = (event: SpecialEvent) => {
    setEditing({ ...event });
    setEditOpen(true);
    fetchOverridesForEvent(event);
  };

  const fetchOverridesForEvent = async (event: SpecialEvent) => {
    if (!event.startDate) return;
    try {
      const res = await fetch("/api/meeting-overrides");
      if (res.ok) {
        const all: { id: string; date: string; meetingType: string; isCancelled: boolean; reason: string | null }[] = await res.json();
        const start = event.startDate;
        const end = event.endDate || event.startDate;
        // Include meetings before/after the event (same logic as cancel)
        const beforeStart = new Date(start + "T00:00:00");
        beforeStart.setDate(beforeStart.getDate() - 7);
        const afterEnd = new Date(end + "T00:00:00");
        afterEnd.setDate(afterEnd.getDate() + 7);
        const filtered = all.filter(o => {
          const d = new Date(o.date + "T00:00:00");
          return d >= beforeStart && d <= afterEnd && o.isCancelled;
        });
        setEventOverrides(filtered);
      }
    } catch {}
  };

  const handleCancelFromDialog = async () => {
    if (!editing?.startDate) return;
    setManageMeetingsBusy(true);
    try {
      const settingsRes = await fetch("/api/settings");
      const settingsData = await settingsRes.json();
      const midweekDay = parseInt(settingsData.midweekDay ?? "2", 10);
      const weekendDay = parseInt(settingsData.weekendDay ?? "6", 10);

      const start = new Date(editing.startDate + "T00:00:00");
      const end = new Date((editing.endDate || editing.startDate) + "T00:00:00");
      const overrides: { date: string; meetingType: string; originalDay: number; isCancelled: boolean; reason: string }[] = [];

      const beforeStart = new Date(start); beforeStart.setDate(beforeStart.getDate() - 1);
      while (beforeStart.getDay() !== midweekDay && beforeStart > new Date(start.getTime() - 14 * 86400000)) beforeStart.setDate(beforeStart.getDate() - 1);
      if (beforeStart.getDay() === midweekDay && beforeStart < start) {
        const ymd = `${beforeStart.getFullYear()}-${String(beforeStart.getMonth()+1).padStart(2,"0")}-${String(beforeStart.getDate()).padStart(2,"0")}`;
        overrides.push({ date: ymd, meetingType: "midweek", originalDay: midweekDay, isCancelled: true, reason: editing.title || "" });
      }
      const beforeStartWeekend = new Date(start); beforeStartWeekend.setDate(beforeStartWeekend.getDate() - 1);
      while (beforeStartWeekend.getDay() !== weekendDay && beforeStartWeekend > new Date(start.getTime() - 14 * 86400000)) beforeStartWeekend.setDate(beforeStartWeekend.getDate() - 1);
      if (beforeStartWeekend.getDay() === weekendDay && beforeStartWeekend < start) {
        const ymd = `${beforeStartWeekend.getFullYear()}-${String(beforeStartWeekend.getMonth()+1).padStart(2,"0")}-${String(beforeStartWeekend.getDate()).padStart(2,"0")}`;
        overrides.push({ date: ymd, meetingType: "weekend", originalDay: weekendDay, isCancelled: true, reason: editing.title || "" });
      }
      const cur = new Date(start);
      while (cur <= end) {
        const dow = cur.getDay();
        const ymd = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
        if (dow === midweekDay) overrides.push({ date: ymd, meetingType: "midweek", originalDay: midweekDay, isCancelled: true, reason: editing.title || "" });
        if (dow === weekendDay) overrides.push({ date: ymd, meetingType: "weekend", originalDay: weekendDay, isCancelled: true, reason: editing.title || "" });
        cur.setDate(cur.getDate() + 1);
      }
      const afterEndWeekend = new Date(end); afterEndWeekend.setDate(afterEndWeekend.getDate() + 1);
      while (afterEndWeekend.getDay() !== weekendDay && afterEndWeekend < new Date(end.getTime() + 7 * 86400000)) afterEndWeekend.setDate(afterEndWeekend.getDate() + 1);
      if (afterEndWeekend.getDay() === weekendDay && afterEndWeekend > end) {
        const ymd = `${afterEndWeekend.getFullYear()}-${String(afterEndWeekend.getMonth()+1).padStart(2,"0")}-${String(afterEndWeekend.getDate()).padStart(2,"0")}`;
        overrides.push({ date: ymd, meetingType: "weekend", originalDay: weekendDay, isCancelled: true, reason: editing.title || "" });
      }
      const afterEndMidweek = new Date(end); afterEndMidweek.setDate(afterEndMidweek.getDate() + 1);
      while (afterEndMidweek.getDay() !== midweekDay && afterEndMidweek < new Date(end.getTime() + 7 * 86400000)) afterEndMidweek.setDate(afterEndMidweek.getDate() + 1);
      if (afterEndMidweek.getDay() === midweekDay && afterEndMidweek > end) {
        const ymd = `${afterEndMidweek.getFullYear()}-${String(afterEndMidweek.getMonth()+1).padStart(2,"0")}-${String(afterEndMidweek.getDate()).padStart(2,"0")}`;
        overrides.push({ date: ymd, meetingType: "midweek", originalDay: midweekDay, isCancelled: true, reason: editing.title || "" });
      }
      const seen = new Set<string>();
      const unique = overrides.filter(o => { const k = `${o.date}:${o.meetingType}`; if (seen.has(k)) return false; seen.add(k); return true; });
      for (const o of unique) {
        await fetch("/api/meeting-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
      }
      toast({ title: `Cancelled ${unique.length} meetings`, description: `Due to: ${editing.title}` });
      if (editing.id) fetchOverridesForEvent(editing as SpecialEvent);
    } catch {
      toast({ title: "Failed to cancel meetings", variant: "destructive" });
    } finally {
      setManageMeetingsBusy(false);
    }
  };

  const handleUncancelFromDialog = async () => {
    if (eventOverrides.length === 0) return;
    setManageMeetingsBusy(true);
    try {
      for (const o of eventOverrides) {
        await fetch(`/api/meeting-overrides?date=${o.date}&meetingType=${o.meetingType}`, { method: "DELETE" });
      }
      toast({ title: `Restored ${eventOverrides.length} meetings` });
      setEventOverrides([]);
    } catch {
      toast({ title: "Failed to restore meetings", variant: "destructive" });
    } finally {
      setManageMeetingsBusy(false);
    }
  };

  const handleSave = async () => {
    if (!editing?.title || !editing?.startDate) return;

    const method = editing.id ? "PUT" : "POST";
    const url = editing.id ? `/api/events/${editing.id}` : "/api/events";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      if (res.ok) {
        toast({ title: editing.id ? "Event updated" : "Event created" });
        setEditOpen(false);
        setEditing(null);
        fetchData();

        // Prompt to cancel meetings for conventions/assemblies/memorials
        const eventTypesToCancel = ["convention", "assembly", "memorial"];
        if (eventTypesToCancel.includes(editing.type || "") && editing.endDate) {
          setCancelMeetingsData({ title: editing.title || "", startDate: editing.startDate || "", endDate: editing.endDate });
        }
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving event", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/events/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Event deleted" });
        setDeleteId(null);
        fetchData();
      }
    } catch {
      toast({ title: "Error deleting event", variant: "destructive" });
    }
  };

  const handleCancelMeetings = async () => {
    if (!cancelMeetingsData) return;
    setCancellingMeetings(true);
    try {
      const settingsRes = await fetch("/api/settings");
      const settingsData = await settingsRes.json();
      const midweekDay = parseInt(settingsData.midweekDay ?? "2", 10);
      const weekendDay = parseInt(settingsData.weekendDay ?? "6", 10);

      const start = new Date(cancelMeetingsData.startDate + "T00:00:00");
      const end = new Date(cancelMeetingsData.endDate + "T00:00:00");
      const overrides: { date: string; meetingType: string; originalDay: number; isCancelled: boolean; reason: string }[] = [];

      // Include the midweek meeting before the event
      const beforeStart = new Date(start);
      beforeStart.setDate(beforeStart.getDate() - 1);
      while (beforeStart.getDay() !== midweekDay && beforeStart > new Date(start.getTime() - 14 * 86400000)) {
        beforeStart.setDate(beforeStart.getDate() - 1);
      }
      if (beforeStart.getDay() === midweekDay && beforeStart < start) {
        const ymdBefore = `${beforeStart.getFullYear()}-${String(beforeStart.getMonth() + 1).padStart(2, "0")}-${String(beforeStart.getDate()).padStart(2, "0")}`;
        overrides.push({ date: ymdBefore, meetingType: "midweek", originalDay: midweekDay, isCancelled: true, reason: cancelMeetingsData.title });
      }

      // Include the weekend meeting before the event (if not already in range)
      const beforeStartWeekend = new Date(start);
      beforeStartWeekend.setDate(beforeStartWeekend.getDate() - 1);
      while (beforeStartWeekend.getDay() !== weekendDay && beforeStartWeekend > new Date(start.getTime() - 14 * 86400000)) {
        beforeStartWeekend.setDate(beforeStartWeekend.getDate() - 1);
      }
      if (beforeStartWeekend.getDay() === weekendDay && beforeStartWeekend < start) {
        const ymdBefore = `${beforeStartWeekend.getFullYear()}-${String(beforeStartWeekend.getMonth() + 1).padStart(2, "0")}-${String(beforeStartWeekend.getDate()).padStart(2, "0")}`;
        overrides.push({ date: ymdBefore, meetingType: "weekend", originalDay: weekendDay, isCancelled: true, reason: cancelMeetingsData.title });
      }

      // Cancel meetings within the event date range
      const cur = new Date(start);
      while (cur <= end) {
        const dayOfWeek = cur.getDay();
        const ymd = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;

        if (dayOfWeek === midweekDay) {
          overrides.push({ date: ymd, meetingType: "midweek", originalDay: midweekDay, isCancelled: true, reason: cancelMeetingsData.title });
        }
        if (dayOfWeek === weekendDay) {
          overrides.push({ date: ymd, meetingType: "weekend", originalDay: weekendDay, isCancelled: true, reason: cancelMeetingsData.title });
        }
        cur.setDate(cur.getDate() + 1);
      }

      // Include the weekend meeting after the event (e.g., convention ends Saturday, meeting is Sunday)
      const afterEndWeekend = new Date(end);
      afterEndWeekend.setDate(afterEndWeekend.getDate() + 1);
      while (afterEndWeekend.getDay() !== weekendDay && afterEndWeekend < new Date(end.getTime() + 7 * 86400000)) {
        afterEndWeekend.setDate(afterEndWeekend.getDate() + 1);
      }
      if (afterEndWeekend.getDay() === weekendDay && afterEndWeekend > end) {
        const ymdAfter = `${afterEndWeekend.getFullYear()}-${String(afterEndWeekend.getMonth() + 1).padStart(2, "0")}-${String(afterEndWeekend.getDate()).padStart(2, "0")}`;
        overrides.push({ date: ymdAfter, meetingType: "weekend", originalDay: weekendDay, isCancelled: true, reason: cancelMeetingsData.title });
      }

      // Include the midweek meeting after the event
      const afterEndMidweek = new Date(end);
      afterEndMidweek.setDate(afterEndMidweek.getDate() + 1);
      while (afterEndMidweek.getDay() !== midweekDay && afterEndMidweek < new Date(end.getTime() + 7 * 86400000)) {
        afterEndMidweek.setDate(afterEndMidweek.getDate() + 1);
      }
      if (afterEndMidweek.getDay() === midweekDay && afterEndMidweek > end) {
        const ymdAfter = `${afterEndMidweek.getFullYear()}-${String(afterEndMidweek.getMonth() + 1).padStart(2, "0")}-${String(afterEndMidweek.getDate()).padStart(2, "0")}`;
        overrides.push({ date: ymdAfter, meetingType: "midweek", originalDay: midweekDay, isCancelled: true, reason: cancelMeetingsData.title });
      }

      // Deduplicate by date+meetingType (keep first occurrence)
      const seenKeys = new Set<string>();
      const uniqueOverrides = overrides.filter(ov => {
        const key = `${ov.date}:${ov.meetingType}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

      for (const ov of uniqueOverrides) {
        await fetch("/api/meeting-overrides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ov),
        });
      }

      toast({
        title: `Cancelled ${uniqueOverrides.length} meetings`,
        description: `Due to: ${cancelMeetingsData.title}`,
      });
    } catch {
      toast({ title: "Failed to cancel meetings", variant: "destructive" });
    } finally {
      setCancellingMeetings(false);
      setCancelMeetingsData(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "events");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setEditing({ ...editing, imageUrl: data.url });
        toast({ title: "Image uploaded" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(language === "tl" ? "fil-PH" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      convention: t("eventConvention", language),
      co_visit: t("eventCoVisit", language),
      assembly: t("eventAssembly", language),
      memorial: t("eventMemorial", language),
      other: t("eventOther", language),
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button onClick={handleCreateConvention} variant="outline" className="rounded-xl">
          <CalendarRange className="h-4 w-4 mr-1" />
          Add Convention
        </Button>
        <Button onClick={handleCreate} className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20">
          <Plus className="h-4 w-4 mr-1" />
          {t("eventCreate", language)}
        </Button>
      </div>

      {events.length === 0 ? (
        <Card className="rounded-2xl border-border/40">
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No events yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="card-hover rounded-2xl border-border/40">
              <CardContent className="flex items-start gap-4 py-4">
                <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${event.color || "bg-blue-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{event.title}</h3>
                    <Badge variant="outline" className="text-xs rounded-md">{typeLabel(event.type)}</Badge>
                    {!event.showOnNoticeboard && <Badge variant="secondary" className="text-xs rounded-md">Hidden</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{formatDate(event.startDate)}{event.endDate ? ` — ${formatDate(event.endDate)}` : ""}</span>
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => handleEdit(event)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => setDeleteId(event.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editing?.id ? t("eventEdit", language) : t("eventCreate", language)}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("eventTitle", language)}</Label>
                <Input
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("eventType", language)}</Label>
                <Select
                  value={editing.type || "other"}
                  onValueChange={(v) => setEditing({ ...editing, type: v })}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="convention">{t("eventConvention", language)}</SelectItem>
                    <SelectItem value="co_visit">{t("eventCoVisit", language)}</SelectItem>
                    <SelectItem value="assembly">{t("eventAssembly", language)}</SelectItem>
                    <SelectItem value="memorial">{t("eventMemorial", language)}</SelectItem>
                    <SelectItem value="other">{t("eventOther", language)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dates</Label>
                <DateRangePicker
                  startDate={editing.startDate || ""}
                  endDate={editing.endDate || ""}
                  onChange={(start, end) => setEditing({ ...editing, startDate: start, endDate: end || null })}
                  placeholder="Select dates"
                  language={language}
                />
              </div>
              <LocationPicker
                location={editing.location || ""}
                latitude={editing.latitude ?? null}
                longitude={editing.longitude ?? null}
                onChange={(data) => setEditing({ ...editing, location: data.location, latitude: data.latitude, longitude: data.longitude })}
              />
              <div className="space-y-2">
                <Label>{t("eventDescription", language)}</Label>
                <Textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("eventImage", language)}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    {t("upload", language)}
                  </Button>
                  {editing.imageUrl && (
                    <span className="text-sm text-muted-foreground truncate">Uploaded</span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("eventColor", language)}</Label>
                <div className="flex gap-2">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      className={`w-8 h-8 rounded-full ${c.value} ${editing.color === c.value ? "ring-2 ring-offset-2 ring-indigo-500" : ""}`}
                      onClick={() => setEditing({ ...editing, color: c.value })}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <Label className="cursor-pointer">{t("eventShowOnNoticeboard", language)}</Label>
                <Switch
                  checked={editing.showOnNoticeboard !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, showOnNoticeboard: v })}
                />
              </div>

              {/* Cancel / Uncancel Meetings */}
              {editing.id && editing.startDate && (
                <div className="space-y-2 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-3">
                  <div className="flex items-center gap-2">
                    <CalendarX className="h-4 w-4 text-amber-600" />
                    <Label className="text-sm font-semibold">Meeting Cancellations</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cancel midweek and weekend meetings during this event's date range, or restore previously cancelled meetings.
                  </p>
                  {eventOverrides.length > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      {eventOverrides.length} meeting(s) currently cancelled for this event
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      onClick={handleCancelFromDialog}
                      disabled={manageMeetingsBusy || !editing.startDate}
                    >
                      {manageMeetingsBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CalendarX className="h-3 w-3 mr-1" />}
                      Cancel Meetings
                    </Button>
                    {eventOverrides.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs"
                        onClick={handleUncancelFromDialog}
                        disabled={manageMeetingsBusy}
                      >
                        {manageMeetingsBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                        Uncancel ({eventOverrides.length})
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>
              {t("cancel", language)}
            </Button>
            <Button onClick={handleSave} className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20">
              {t("save", language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>{t("eventDeleteConfirm", language)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", language)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("delete", language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Meetings Confirmation */}
      <AlertDialog open={!!cancelMeetingsData} onOpenChange={(open) => !open && setCancelMeetingsData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarX className="h-5 w-5 text-amber-600" />
              Cancel meetings for this event?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelMeetingsData && (
                <span className="space-y-2 block">
                  <span className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Would you like to cancel all midweek and weekend meetings from {cancelMeetingsData.startDate} to {cancelMeetingsData.endDate} due to "{cancelMeetingsData.title}"? This also includes meetings immediately before and after the event that fall on the regular meeting days.</span>
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, skip</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={cancellingMeetings}
              onClick={handleCancelMeetings}
            >
              {cancellingMeetings ? "Cancelling..." : "Yes, cancel meetings"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
