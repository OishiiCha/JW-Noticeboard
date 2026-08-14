"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Clock, MapPin, FileText, CalendarDays, Video, Check, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

interface CalendarEvent {
  id: string;
  date: string;
  type: "meeting" | "notice" | "special" | "override";
  title: string;
  subtitle?: string;
  isPublished: boolean;
  meta?: Record<string, unknown>;
}

const TYPE_COLORS: Record<string, string> = {
  meeting: "bg-blue-500",
  special: "bg-purple-500",
  notice: "bg-amber-500",
  override: "bg-red-500",
};

// Hex fallbacks for inline styles — guarantees correct colors even if Tailwind purges a class
const TYPE_HEX: Record<string, string> = {
  meeting: "#3b82f6",
  special: "#a855f7",
  notice: "#f59e0b",
  override: "#ef4444",
};

// Map of known Tailwind bg-* classes to hex values for inline style fallback
const TW_BG_TO_HEX: Record<string, string> = {
  "bg-blue-500": "#3b82f6",
  "bg-green-500": "#22c55e",
  "bg-purple-500": "#a855f7",
  "bg-rose-500": "#f43f5e",
  "bg-slate-500": "#64748b",
  "bg-amber-500": "#f59e0b",
  "bg-red-500": "#ef4444",
  "bg-gray-500": "#6b7280",
  "bg-indigo-500": "#6366f1",
  "bg-teal-500": "#14b8a6",
  "bg-cyan-500": "#06b6d4",
  "bg-orange-500": "#f97316",
  "bg-pink-500": "#ec4899",
  "bg-sky-500": "#0ea5e9",
  "bg-emerald-500": "#10b981",
};

const TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  special: "Special Event",
  notice: "Notice",
  override: "Override",
};

// Resolve event color to inline style — always uses inline style for reliability
// Always use type-based color — enforces visual distinction between event types
function resolveBarColor(type: string): { cls: string; style: { backgroundColor: string } } {
  const fallbackClass = TYPE_COLORS[type] || "bg-gray-500";
  const fallbackHex = TW_BG_TO_HEX[fallbackClass] || "#6b7280";
  return { cls: fallbackClass, style: { backgroundColor: fallbackHex } };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ language = "en", isAdmin = false, onEditEvent, onEditNotice }: { language?: Language; isAdmin?: boolean; onEditEvent?: (eventId: string) => void; onEditNotice?: (noticeId: string) => void }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [calendarStartDay, setCalendarStartDay] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "agenda">("month");
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const toggleType = (type: string) => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const visibleEvents = events.filter(e => !hiddenTypes.has(e.type));

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, unknown>) => {
        if (data.calendarStartDay !== undefined) {
          const parsed = parseInt(String(data.calendarStartDay), 10);
          if (!Number.isNaN(parsed)) setCalendarStartDay(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?month=${currentMonth + 1}&year=${currentYear}`);
      if (res.ok) setEvents(await res.json());
    } catch (error) {
      console.error("Error fetching calendar:", error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const prevMonth = () => {
    // Don't allow navigating more than 1 week before current month
    const now = new Date();
    const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    if (prevMonthDate < oneWeekAgo && !(currentMonth === now.getMonth() && currentYear === now.getFullYear())) {
      // Already at the limit — go to current month instead
      goToToday();
      return;
    }
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentMonth(new Date().getMonth());
    setCurrentYear(new Date().getFullYear());
  };

  // Build calendar grid — respect calendar start day setting (0=Sun, 1=Mon, 6=Sat)
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Adjust first day based on calendar start day (same logic as parent project)
  const adjustedFirstDay = (firstDay - calendarStartDay + 7) % 7;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const dayNames = [...DAYS.slice(calendarStartDay), ...DAYS.slice(0, calendarStartDay)];

  const getEventsForDate = (dateStr: string) => visibleEvents.filter((e) => e.date === dateStr);

  // Generate calendar cells
  const cells: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

  // Previous month padding
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const month = currentMonth === 0 ? 12 : currentMonth;
    const year = currentMonth === 0 ? currentYear - 1 : currentYear;
    cells.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      isCurrentMonth: true,
    });
  }

  // Next month padding — only fill to complete the last row (not always 6 rows)
  const remaining = cells.length % 7 !== 0 ? 7 - (cells.length % 7) : 0;
  for (let d = 1; d <= remaining; d++) {
    const month = currentMonth === 11 ? 1 : currentMonth + 2;
    const year = currentMonth === 11 ? currentYear + 1 : currentYear;
    cells.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      isCurrentMonth: false,
    });
  }

  if (loading && events.length === 0) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  return (
    <div className="space-y-4 w-full">
      {/* View Toggle + Month Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="rounded-xl" disabled={(() => {
            const now = new Date();
            const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
            const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
            return prevMonthDate < oneWeekAgo;
          })()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} className="rounded-xl">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-base sm:text-xl font-bold ml-2 tracking-tight">{monthName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border/40 overflow-hidden">
            <button
              onClick={() => setViewMode("month")}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-colors ${viewMode === "month" ? "bg-indigo-500 text-white" : "hover:bg-accent"}`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-colors ${viewMode === "agenda" ? "bg-indigo-500 text-white" : "hover:bg-accent"}`}
            >
              Agenda
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={goToToday} className="rounded-xl">
            {t("today", language)}
          </Button>
        </div>
      </div>

      {/* Calendar Grid — only in month view */}
      {viewMode === "month" && (
      <Card className="rounded-2xl border-border/40 overflow-visible">
        <CardContent className="p-0 overflow-visible">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border/40">
            {dayNames.map((d) => (
              <div key={d} className="p-1.5 sm:p-2.5 text-center text-xs sm:text-sm font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          {/* Days — week rows with lane-packed event bars */}
          <div>
            {(() => {
              const TYPE_PRIORITY: Record<string, number> = { override: 0, meeting: 1, special: 2, notice: 3 };
              const priorityOf = (e: CalendarEvent) => TYPE_PRIORITY[e.type] ?? 4;
              const baseIdOf = (id: string) => id.replace(/-\d{4}-\d{2}-\d{2}$/, "");
              const MAX_LANES = 4;

              interface Segment { baseId: string; event: CalendarEvent; startCol: number; endCol: number }

              const weeks: Array<Array<{ date: string; day: number; isCurrentMonth: boolean }>> = [];
              for (let w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));

              const tooltip = (event: CalendarEvent, tooltipSide: string) => (
                <div className={`hidden sm:block invisible opacity-0 group-hover/event:visible group-hover/event:opacity-100 transition-opacity duration-200 absolute ${tooltipSide} top-full z-[100] mt-1 w-72 p-3 rounded-xl bg-popover border border-border shadow-2xl pointer-events-none`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_HEX[event.type] || "#6b7280" }} />
                    <span className="text-xs font-semibold">{TYPE_LABELS[event.type] || "Event"}</span>
                  </div>
                  <p className="text-sm font-medium leading-tight mb-1">{(event.meta?.fullTitle as string) || event.title}</p>
                  {event.subtitle && <p className="text-xs text-muted-foreground line-clamp-2">{event.subtitle}</p>}
                  {Boolean(event.meta?.imageUrl) && (
                    <img src={String(event.meta!.imageUrl)} alt={event.title} className="w-full h-28 object-cover rounded-lg mt-2 mb-1" />
                  )}
                  {Boolean(event.meta?.fileUrl) && !event.meta?.imageUrl && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 mt-1.5">
                      <FileText className="h-3 w-3" />
                      <span className="truncate">Attached file</span>
                    </div>
                  )}
                  {event.meta && (
                    <div className="mt-1.5 space-y-1">
                      {Boolean(event.meta.time) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{String(event.meta.time)}</div>
                      )}
                      {Boolean(event.meta.location) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /><span className="truncate">{String(event.meta.location)}</span></div>
                      )}
                      {Boolean(event.meta.description) && (
                        <p className="text-xs text-muted-foreground line-clamp-3 pt-0.5">{String(event.meta.description)}</p>
                      )}
                    </div>
                  )}
                </div>
              );

              return weeks.map((week, wi) => {
                // Build multi-day segments intersecting this week row
                const segments: Segment[] = [];
                for (let c = 0; c < 7; c++) {
                  const md = getEventsForDate(week[c].date).filter(e => e.meta?.multiDay === true);
                  for (const e of md) {
                    const baseId = baseIdOf(e.id);
                    if (segments.some(s => s.baseId === baseId)) continue;
                    let endCol = c;
                    while (endCol + 1 < 7 && getEventsForDate(week[endCol + 1].date).some(x => x.meta?.multiDay === true && baseIdOf(x.id) === baseId)) endCol++;
                    segments.push({ baseId, event: e, startCol: c, endCol });
                  }
                }
                // Assign lowest free lane by priority so bars pack without gaps
                segments.sort((a, b) => priorityOf(a.event) - priorityOf(b.event) || a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));
                const laneOf = new Map<string, number>();
                const laneSegs: Segment[][] = [];
                for (const seg of segments) {
                  let lane = 0;
                  while ((laneSegs[lane] || []).some(s => s.startCol <= seg.endCol && seg.startCol <= s.endCol)) lane++;
                  (laneSegs[lane] ||= []).push(seg);
                  laneOf.set(seg.baseId, lane);
                }

                return (
                  <div key={wi} className="grid grid-cols-7">
                    {week.map((cell, c) => {
                      const dayEvents = getEventsForDate(cell.date);
                      const isToday = cell.date === todayStr;
                      const isPast = cell.date < todayStr;
                      const tooltipSide = c >= 5 ? "right-0" : "left-0";

                      // Multi-day segments crossing this column, by lane
                      const crossing = new Map<number, Segment>();
                      for (const seg of segments) {
                        const lane = laneOf.get(seg.baseId)!;
                        if (seg.startCol <= c && c <= seg.endCol && lane < MAX_LANES) crossing.set(lane, seg);
                      }

                      // Single-day events fill lowest free lanes, priority first
                      const singles = dayEvents.filter(e => !(e.meta?.multiDay)).sort((a, b) => priorityOf(a) - priorityOf(b));
                      const singleAtLane = new Map<number, CalendarEvent>();
                      let hidden = 0;
                      for (const ev of singles) {
                        let lane = 0;
                        while (crossing.has(lane) || singleAtLane.has(lane)) lane++;
                        if (lane >= MAX_LANES) { hidden++; continue; }
                        singleAtLane.set(lane, ev);
                      }
                      for (const seg of segments) {
                        const lane = laneOf.get(seg.baseId)!;
                        if (lane >= MAX_LANES && seg.startCol === c) hidden++;
                      }

                      const topLane = Math.max(-1, ...Array.from(crossing.keys()), ...Array.from(singleAtLane.keys()));

                      return (
                        <div
                          key={c}
                          className={`relative min-h-10 sm:min-h-[80px] p-1 sm:p-1.5 border-b border-border/40 overflow-visible ${c < 6 ? "border-r" : ""} ${
                            !cell.isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""
                          } ${isToday ? "bg-indigo-50 dark:bg-indigo-950/20" : ""} ${
                            isPast && cell.isCurrentMonth ? "bg-muted/10 opacity-50" : ""
                          }`}
                        >
                          <div className={`text-xs sm:text-xs font-semibold mb-0.5 ${isToday ? "text-indigo-600 dark:text-indigo-400" : ""}`}>
                            {cell.day}
                          </div>

                          {/* Multi-day bars starting at this column — absolutely positioned, extend right */}
                          {segments.filter(s => s.startCol === c && laneOf.get(s.baseId)! < MAX_LANES).map(seg => {
                            const lane = laneOf.get(seg.baseId)!;
                            const span = seg.endCol - seg.startCol + 1;
                            const segColor = resolveBarColor(seg.event.type);
                            return (
                              <div
                                key={seg.baseId}
                                className="cal-multi-bar group/event hover:z-50"
                                style={{ "--span": span, "--lane": lane, ...(segColor.style || {}) } as CSSProperties}
                              >
                                <button
                                  onClick={() => setSelectedEvent(seg.event)}
                                  className={`block w-full h-full rounded-full ring-1 ring-inset ring-black/10 hover:opacity-80 transition-opacity ${segColor.cls} ${isPast ? "opacity-40 grayscale" : ""}`}
                                  style={segColor.style}
                                  title={(seg.event.meta?.fullTitle as string) || seg.event.title}
                                />
                                {tooltip(seg.event, tooltipSide)}
                              </div>
                            );
                          })}

                          {/* Single-day events in lane flow + spacer divs for crossing multi-day bars */}
                          {topLane >= 0 && (
                            <div className="space-y-0.5">
                              {Array.from({ length: topLane + 1 }, (_, lane) => {
                                const seg = crossing.get(lane);
                                const ev = singleAtLane.get(lane);
                                const evColor = ev ? resolveBarColor(ev.type) : null;
                                return (
                                  <div key={lane} className="h-2 sm:h-2.5">
                                    {!seg && ev && (
                                      <div className="relative group/event h-full hover:z-50">
                                        <button
                                          onClick={() => setSelectedEvent(ev)}
                                          className={`block w-full h-full rounded-full ring-1 ring-inset ring-black/10 hover:opacity-80 transition-opacity ${evColor!.cls} ${isPast ? "opacity-40 grayscale" : ""}`}
                                          style={evColor!.style}
                                          title={(ev.meta?.fullTitle as string) || ev.title}
                                        />
                                        {tooltip(ev, tooltipSide)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {hidden > 0 && (
                                <span className="text-[7px] sm:text-[9px] text-muted-foreground pl-1">+{hidden} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Agenda view — only in agenda view */}
      {viewMode === "agenda" && (
      <div className="space-y-2">
        {visibleEvents.length === 0 ? (
          <Card className="rounded-2xl border-border/40">
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No events this month
            </CardContent>
          </Card>
        ) : (
          visibleEvents
            .filter((e) => e.date >= `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01` && e.date <= `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((event) => {
              const isToday = event.date === todayStr;
              return (
                <Card key={event.id} className={`rounded-2xl border-border/40 card-hover cursor-pointer ${isToday ? "border-indigo-300 dark:border-indigo-700/50" : ""}`} onClick={() => setSelectedEvent(event)}>
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex flex-col items-center justify-center min-w-[44px] shrink-0">
                      <span className="text-lg font-bold leading-none">{new Date(event.date + "T00:00:00").getDate()}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{new Date(event.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}</span>
                    </div>
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: TYPE_HEX[event.type] || "#6b7280" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(event.meta?.fullTitle as string) || event.title}</p>
                      {event.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{event.subtitle}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>
      )}

      {/* Type filters — below calendar */}
      <div className="flex flex-wrap gap-x-3 gap-y-2 mt-3">
        {(["meeting", "special", "notice", "override"] as const).map(type => {
          const isHidden = hiddenTypes.has(type);
          return (
            <label key={type} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <button
                type="button"
                onClick={() => toggleType(type)}
                className={`flex items-center justify-center w-4 h-4 rounded border-2 transition-colors ${isHidden ? "border-muted-foreground/30 bg-transparent" : "border-transparent"}`}
                style={!isHidden ? { backgroundColor: TYPE_HEX[type] } : {}}
              >
                {!isHidden && <Check className="h-3 w-3 text-white" />}
              </button>
              <span className={`w-3 h-1.5 rounded-sm ${isHidden ? "opacity-30" : ""}`} style={{ backgroundColor: TYPE_HEX[type] }} />
              <span className={isHidden ? "text-muted-foreground line-through" : ""}>{TYPE_LABELS[type]}</span>
            </label>
          );
        })}
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(o) => { if (!o) setSelectedEvent(null); }}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedEvent ? TYPE_HEX[selectedEvent.type] || "#6b7280" : "#6b7280" }} />
              {(selectedEvent?.meta?.fullTitle as string) || selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="rounded-md">
                  {(selectedEvent.meta?.fullTitle as string) || TYPE_LABELS[selectedEvent.type] || "Event"}
                </Badge>
                <Badge variant="outline" className="rounded-md">
                  <CalendarDays className="h-3 w-3 mr-1" />
                  {(() => {
                    const meta = selectedEvent.meta;
                    const startDate = meta?.startDate as string || selectedEvent.date;
                    const endDate = meta?.endDate as string;
                    if (endDate && endDate !== startDate) {
                      const startFmt = new Date(startDate + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "long", day: "numeric", year: "numeric",
                      });
                      const endFmt = new Date(endDate + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "long", day: "numeric", year: "numeric",
                      });
                      return `${startFmt} — ${endFmt}`;
                    }
                    return new Date(startDate + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric", year: "numeric",
                    });
                  })()}
                </Badge>
              </div>

              {selectedEvent.subtitle && (
                <p className="text-sm text-muted-foreground">{selectedEvent.subtitle}</p>
              )}

              {Boolean(selectedEvent.meta?.imageUrl) && (
                <img src={String(selectedEvent.meta!.imageUrl)} alt={selectedEvent.title} className="w-full max-h-64 object-cover rounded-xl" />
              )}

              {selectedEvent.meta && (
                <div className="space-y-2">
                  {Boolean(selectedEvent.meta.time) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-indigo-500" />
                      <span>{String(selectedEvent.meta.time)}</span>
                    </div>
                  )}
                  {Boolean(selectedEvent.meta.location) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span>{String(selectedEvent.meta.location)}</span>
                      </div>
                      {selectedEvent.meta.latitude != null && selectedEvent.meta.longitude != null ? (
                        <div className="rounded-xl overflow-hidden border border-border/40">
                          <iframe
                            title="Event location map"
                            width="100%"
                            height="200"
                            loading="lazy"
                            style={{ border: 0 }}
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(selectedEvent.meta.longitude) - 0.01},${Number(selectedEvent.meta.latitude) - 0.008},${Number(selectedEvent.meta.longitude) + 0.01},${Number(selectedEvent.meta.latitude) + 0.008}&marker=${selectedEvent.meta.latitude},${selectedEvent.meta.longitude}`}
                          />
                          <div className="flex gap-2 p-2 bg-muted/20">
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedEvent.meta.latitude},${selectedEvent.meta.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                            >
                              Directions
                            </a>
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${selectedEvent.meta.latitude}&mlon=${selectedEvent.meta.longitude}#map=16/${selectedEvent.meta.latitude}/${selectedEvent.meta.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              View larger map
                            </a>
                          </div>
                        </div>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(selectedEvent.meta.location))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                          <MapPin className="h-3 w-3" /> Search on Google Maps
                        </a>
                      )}
                    </div>
                  )}
                  {Boolean(selectedEvent.meta.fileUrl) && (
                    <a href={String(selectedEvent.meta.fileUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                      <FileText className="h-4 w-4" />
                      <span>View schedule file</span>
                    </a>
                  )}
                  {Boolean(selectedEvent.meta.zoomId) && (() => {
                    const zid = String(selectedEvent.meta.zoomId);
                    const zpass = selectedEvent.meta.zoomPasscode ? String(selectedEvent.meta.zoomPasscode) : "";
                    const zoomUrl = `https://zoom.us/j/${zid}${zpass ? `?pwd=${zpass}` : ""}`;
                    return (
                      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                          <Video className="h-4 w-4" />
                          Zoom Meeting
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Meeting ID:</span>
                          <span className="font-mono">{zid}</span>
                        </div>
                        {zpass && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Passcode:</span>
                            <span className="font-mono">{zpass}</span>
                          </div>
                        )}
                        <a
                          href={zoomUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                        >
                          <Video className="h-4 w-4" />
                          Join Zoom Meeting
                        </a>
                      </div>
                    );
                  })()}
                  {Boolean(selectedEvent.meta.description) && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span>{String(selectedEvent.meta.description)}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Admin actions */}
              {isAdmin && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  {selectedEvent.type === "special" && Boolean(selectedEvent.meta?.eventId) && onEditEvent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        onEditEvent(String(selectedEvent.meta!.eventId));
                        setSelectedEvent(null);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1.5" /> Edit Event
                    </Button>
                  )}
                  {selectedEvent.type === "notice" && Boolean(selectedEvent.meta?.noticeId) && onEditNotice && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => {
                        onEditNotice(String(selectedEvent.meta!.noticeId));
                        setSelectedEvent(null);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1.5" /> Edit Notice
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
