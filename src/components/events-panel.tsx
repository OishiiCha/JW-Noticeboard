"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Edit2, Trash2, CalendarDays, X, MapPin, XCircle, Clock, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  zoomId?: string | null;
  zoomPasscode?: string | null;
  showOnNoticeboard: boolean;
  createdAt: string;
  updatedAt: string;
}

const EVENT_TYPES = [
  { value: "convention", label: "Convention" },
  { value: "co_visit", label: "Circuit Overseer Visit" },
  { value: "assembly", label: "Assembly" },
  { value: "memorial", label: "Memorial" },
  { value: "other", label: "Other" },
];

// Auto-assign colors based on event type — matches calendar
const TYPE_COLOR_MAP: Record<string, string> = {
  convention: "bg-blue-500",
  assembly: "bg-green-500",
  co_visit: "bg-purple-500",
  memorial: "bg-rose-500",
  other: "bg-slate-500",
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function EventsPanel() {
  const { toast } = useToast();
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SpecialEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Cancel meeting state
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelDate, setCancelDate] = useState("");
  const [cancelScope, setCancelScope] = useState<"midweek" | "weekend" | "both">("both");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelCreateNotice, setCancelCreateNotice] = useState(true);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [overrides, setOverrides] = useState<{ id: string; date: string; meetingType: string; isCancelled: boolean; reason: string | null; overrideDay: number | null; overrideTime: string | null }[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState("convention");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [showOnNoticeboard, setShowOnNoticeboard] = useState(true);
  const [zoomId, setZoomId] = useState("");
  const [zoomPasscode, setZoomPasscode] = useState("");
  const [cancelMidweek, setCancelMidweek] = useState(false);
  const [cancelWeekend, setCancelWeekend] = useState(false);
  const [meetingDays, setMeetingDays] = useState<{ midweek: number; weekend: number }>({ midweek: 2, weekend: 6 });

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) setEvents(await res.json());
    } catch {
      console.error("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOverrides = useCallback(async () => {
    try {
      const res = await fetch("/api/meeting-overrides");
      if (res.ok) setOverrides(await res.json());
    } catch {
      console.error("Failed to fetch overrides");
    }
  }, []);

  useEffect(() => { fetchEvents(); fetchOverrides(); fetch("/api/settings").then(r => r.ok ? r.json() : {}).then((d: Record<string, unknown>) => { setMeetingDays({ midweek: d.midweekDay !== undefined ? Number(d.midweekDay) : 2, weekend: d.weekendDay !== undefined ? Number(d.weekendDay) : 6 }); }).catch(() => {}); }, [fetchEvents, fetchOverrides]);

  const resetForm = () => {
    setTitle(""); setType("convention"); setStartDate(""); setEndDate("");
    setLocation(""); setDescription("");
    setShowOnNoticeboard(true); setEditing(null);
    setZoomId(""); setZoomPasscode("");
    setCancelMidweek(false); setCancelWeekend(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (ev: SpecialEvent) => {
    setEditing(ev);
    setTitle(ev.title);
    setType(ev.type);
    setStartDate(ev.startDate);
    setEndDate(ev.endDate || "");
    setLocation(ev.location || "");
    setDescription(ev.description || "");
    setShowOnNoticeboard(ev.showOnNoticeboard);
    setZoomId(ev.zoomId || "");
    setZoomPasscode(ev.zoomPasscode || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title || !startDate) return;
    setSaving(true);
    try {
      const payload = {
        title, type, startDate,
        endDate: endDate || undefined,
        location: location || undefined,
        description: description || undefined,
        color: TYPE_COLOR_MAP[type] || "bg-slate-500", showOnNoticeboard,
        zoomId: zoomId || undefined,
        zoomPasscode: zoomPasscode || undefined,
      };
      const url = editing ? `/api/events/${editing.id}` : "/api/events";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if ((cancelMidweek || cancelWeekend) && startDate) {
          const end = endDate || startDate;
          const cursor = new Date(startDate + "T00:00:00");
          const endDt = new Date(end + "T00:00:00");
          const cancelReason = `${title} — ${new Date(startDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}${end !== startDate ? `–${new Date(end + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}`;
          while (cursor <= endDt) {
            const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
            const dow = cursor.getDay();
            if (cancelMidweek && dow === meetingDays.midweek) {
              await fetch("/api/meeting-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: dateStr, meetingType: "midweek", isCancelled: true, reason: cancelReason, createNotice: true }) });
            }
            if (cancelWeekend && dow === meetingDays.weekend) {
              await fetch("/api/meeting-overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: dateStr, meetingType: "weekend", isCancelled: true, reason: cancelReason, createNotice: true }) });
            }
            cursor.setDate(cursor.getDate() + 1);
          }
        }
        toast({ title: editing ? "Event updated" : "Event created" });
        setShowForm(false);
        resetForm();
        fetchEvents();
      } else {
        toast({ title: "Error saving event", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving event", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Event deleted" });
        fetchEvents();
      } else {
        toast({ title: "Error deleting event", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error deleting event", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 h-20 bg-muted/30 rounded-xl" />
          </Card>
        ))}
      </div>
    );
  }

  const handleCancelMeeting = async () => {
    if (!cancelDate) return;
    setCancelSaving(true);
    try {
      const types = cancelScope === "both" ? ["midweek", "weekend"] : [cancelScope];
      for (const mt of types) {
        await fetch("/api/meeting-overrides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: cancelDate,
            meetingType: mt,
            isCancelled: true,
            reason: cancelReason,
            createNotice: cancelCreateNotice,
          }),
        });
      }
      toast({ title: `Meeting${types.length > 1 ? "s" : ""} cancelled` });
      setShowCancelForm(false);
      setCancelDate("");
      setCancelReason("");
      setCancelCreateNotice(true);
      fetchOverrides();
    } catch {
      toast({ title: "Error cancelling meeting", variant: "destructive" });
    } finally {
      setCancelSaving(false);
    }
  };

  const removeOverride = async (date: string, meetingType: string) => {
    try {
      await fetch(`/api/meeting-overrides?date=${date}&meetingType=${meetingType}`, { method: "DELETE" });
      fetchOverrides();
      toast({ title: "Override removed" });
    } catch {
      toast({ title: "Error removing override", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-purple-600" />
            Special Events
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and manage events shown on the calendar and noticeboard.
          </p>
        </div>
        <div className="flex gap-2">
          {!showCancelForm && (
            <Button size="sm" variant="outline" className="rounded-lg border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => setShowCancelForm(true)}>
              <XCircle className="h-4 w-4 mr-1" />
              Cancel Meeting
            </Button>
          )}
          {!showForm && (
            <Button size="sm" className="rounded-lg bg-indigo-600 hover:bg-indigo-700" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Add Event
            </Button>
          )}
        </div>
      </div>

      {/* Cancel Meeting Form */}
      {showCancelForm && (
        <Card className="border-red-200 dark:border-red-800/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Cancel Meeting
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setShowCancelForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Meeting Date</Label>
                <Input type="date" value={cancelDate} onChange={e => setCancelDate(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Which Meeting(s)?</Label>
                <div className="flex rounded-lg border border-border/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCancelScope("midweek")}
                    className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${cancelScope === "midweek" ? "bg-blue-500 text-white" : "hover:bg-accent"}`}
                  >MW</button>
                  <button
                    type="button"
                    onClick={() => setCancelScope("weekend")}
                    className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${cancelScope === "weekend" ? "bg-purple-500 text-white" : "hover:bg-accent"}`}
                  >WE</button>
                  <button
                    type="button"
                    onClick={() => setCancelScope("both")}
                    className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${cancelScope === "both" ? "bg-red-500 text-white" : "hover:bg-accent"}`}
                  >Both</button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} placeholder="e.g. No meeting due to convention" className="rounded-lg" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={cancelCreateNotice} onChange={e => setCancelCreateNotice(e.target.checked)} className="rounded accent-red-500" />
              Create a notice on the board about this
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setShowCancelForm(false)}>Cancel</Button>
              <Button size="sm" className="rounded-lg bg-red-600 hover:bg-red-700" disabled={!cancelDate || cancelSaving} onClick={handleCancelMeeting}>
                {cancelSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Cancel Meeting{cancelScope === "both" ? "s" : ""}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing overrides */}
      {overrides.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800/40">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cancelled / Rescheduled Meetings</p>
            {overrides.map(o => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border/40 p-2.5">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${o.isCancelled ? "bg-red-100 text-red-600 dark:bg-red-950/30" : "bg-amber-100 text-amber-600 dark:bg-amber-950/30"}`}>
                  {o.isCancelled ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {o.meetingType === "midweek" ? "Midweek" : "Weekend"} — {o.isCancelled ? "CANCELLED" : "Rescheduled"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  {o.reason && <p className="text-xs text-muted-foreground truncate mt-0.5">{o.reason}</p>}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-600" onClick={() => removeOverride(o.date, o.meetingType)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card className="border-indigo-200 dark:border-indigo-800/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{editing ? "Edit Event" : "New Event"}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { setShowForm(false); resetForm(); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" className="rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date (optional)</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location (optional)</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Event location" className="rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Video className="h-3 w-3" /> Zoom ID (optional)</Label>
                <Input value={zoomId} onChange={e => setZoomId(e.target.value)} placeholder="e.g. 1234567890" className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Zoom Passcode (optional)</Label>
                <Input value={zoomPasscode} onChange={e => setZoomPasscode(e.target.value)} placeholder="e.g. 123456" className="rounded-lg" />
              </div>
            </div>
            {startDate && (
              <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Cancel meetings during this event</p>
                <p className="text-[11px] text-muted-foreground">Creates cancellation notices on the noticeboard for affected meeting days.</p>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={cancelMidweek} onChange={e => setCancelMidweek(e.target.checked)} className="rounded accent-amber-500" />
                  Cancel Midweek Meetings
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={cancelWeekend} onChange={e => setCancelWeekend(e.target.checked)} className="rounded accent-amber-500" />
                  Cancel Weekend Meetings
                </label>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showOnNoticeboard} onChange={e => setShowOnNoticeboard(e.target.checked)} className="rounded accent-indigo-500" />
              Show on calendar
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
              <Button size="sm" className="rounded-lg bg-indigo-600 hover:bg-indigo-700" disabled={!title || !startDate || saving} onClick={handleSave}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editing ? "Update" : "Create"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events list */}
      {events.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No events yet. Click "Add Event" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <Card key={ev.id} className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-1 h-12 rounded-full shrink-0 ${ev.color || TYPE_COLOR_MAP[ev.type] || "bg-slate-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{ev.title}</p>
                    <span className="text-[10px] text-muted-foreground uppercase shrink-0">
                      {EVENT_TYPES.find(t => t.value === ev.type)?.label || ev.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(ev.startDate)}
                    {ev.endDate && ev.endDate !== ev.startDate && ` → ${formatDate(ev.endDate)}`}
                  </p>
                  {ev.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{ev.location}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => openEdit(ev)} title="Edit">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-600"
                    disabled={deletingId === ev.id}
                    onClick={() => handleDelete(ev.id)}
                    title="Delete"
                  >
                    {deletingId === ev.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
