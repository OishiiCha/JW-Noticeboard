"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, ShieldAlert, Clock, Users, CalendarDays, MapPin, Building2, XCircle, CalendarX, Trash2, Plus, Copy, Lock, Video } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

const LocationPicker = dynamic(() => import("@/components/location-picker").then(m => m.LocationPicker), { ssr: false });

interface MeetingOverride {
  id: string;
  date: string;
  meetingType: string;
  originalDay: number | null;
  overrideDay: number | null;
  overrideTime: string | null;
  isCancelled: boolean;
  reason: string | null;
  createdAt: string;
}

const DAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function SettingsPanel({ language = "en", section = "all", onSaved }: { language?: Language; section?: "all" | "meetings" | "display" | "conventions" | "map"; onSaved?: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [midweekDay, setMidweekDay] = useState("2");
  const [midweekTime, setMidweekTime] = useState("18:30");
  const [weekendDay, setWeekendDay] = useState("6");
  const [weekendTime, setWeekendTime] = useState("15:00");
  const [calendarStartDay, setCalendarStartDay] = useState("1");
  const [meetingLocation, setMeetingLocation] = useState("Kingdom Hall");
  const [congregationTitle, setCongregationTitle] = useState("");
  const [mapEmbedUrl, setMapEmbedUrl] = useState("");
  const [mapAddress, setMapAddress] = useState("");
  const [mapLat, setMapLat] = useState("");
  const [mapLng, setMapLng] = useState("");
  const [conventionStartDay, setConventionStartDay] = useState("5"); // Friday
  const [conventionEndDay, setConventionEndDay] = useState("0"); // Sunday
  const [overrides, setOverrides] = useState<MeetingOverride[]>([]);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideMeetingType, setOverrideMeetingType] = useState("midweek");
  const [overrideIsCancelled, setOverrideIsCancelled] = useState(true);
  const [overrideDay, setOverrideDay] = useState<string>("");
  const [overrideTime, setOverrideTime] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideCreateNotice, setOverrideCreateNotice] = useState(true);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [topBarColor, setTopBarColor] = useState("");
  const [sideBarColor, setSideBarColor] = useState("");
  const [noticeboardPasscode, setNoticeboardPasscode] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const [defaultZoomId, setDefaultZoomId] = useState("");
  const [defaultZoomPasscode, setDefaultZoomPasscode] = useState("");
  const [roleEntries, setRoleEntries] = useState<{ name: string; count: number }[]>([
    { name: "Audio", count: 1 },
    { name: "Video", count: 1 },
    { name: "Microphone", count: 2 },
    { name: "Security", count: 1 },
    { name: "Attendant", count: 1 },
  ]);

  const fetchOverrides = useCallback(async () => {
    try {
      const res = await fetch("/api/meeting-overrides");
      if (res.ok) setOverrides(await res.json());
    } catch (error) {
      console.error("Error fetching overrides:", error);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.midweekDay !== undefined) setMidweekDay(String(data.midweekDay));
        if (data.midweekTime !== undefined) setMidweekTime(String(data.midweekTime));
        if (data.weekendDay !== undefined) setWeekendDay(String(data.weekendDay));
        if (data.weekendTime !== undefined) setWeekendTime(String(data.weekendTime));
        if (data.calendarStartDay !== undefined) setCalendarStartDay(String(data.calendarStartDay));
        if (data.meetingLocation !== undefined) setMeetingLocation(String(data.meetingLocation));
        if (data.congregationTitle !== undefined) setCongregationTitle(String(data.congregationTitle));
        if (data.mapEmbedUrl !== undefined) setMapEmbedUrl(String(data.mapEmbedUrl));
        if (data.mapAddress !== undefined) setMapAddress(String(data.mapAddress));
        if (data.mapLat !== undefined) setMapLat(String(data.mapLat));
        if (data.mapLng !== undefined) setMapLng(String(data.mapLng));
        if (data.conventionStartDay !== undefined) setConventionStartDay(String(data.conventionStartDay));
        if (data.conventionEndDay !== undefined) setConventionEndDay(String(data.conventionEndDay));
        if (data.topBarColor !== undefined) setTopBarColor(String(data.topBarColor));
        if (data.sideBarColor !== undefined) setSideBarColor(String(data.sideBarColor));
        if (data.noticeboardPasscode !== undefined) setNoticeboardPasscode(String(data.noticeboardPasscode));
        if (data.siteDomain !== undefined) setSiteDomain(String(data.siteDomain));
        if (data.defaultZoomId !== undefined) setDefaultZoomId(String(data.defaultZoomId));
        if (data.defaultZoomPasscode !== undefined) setDefaultZoomPasscode(String(data.defaultZoomPasscode));
        if (data.roleEntries !== undefined) {
          const re = data.roleEntries;
          if (Array.isArray(re)) setRoleEntries(re.map((r: { name: string; count: number }) => ({ name: String(r.name), count: Number(r.count) })));
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    if (section === "meetings") fetchOverrides();
  }, [fetchSettings, fetchOverrides, section]);

  const handleSave = async () => {
    setSaving(true);
    setForbidden(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          midweekDay,
          midweekTime,
          weekendDay,
          weekendTime,
          calendarStartDay,
          meetingLocation,
          congregationTitle,
          mapEmbedUrl,
          mapAddress,
          mapLat,
          mapLng,
          conventionStartDay,
          conventionEndDay,
          topBarColor,
          sideBarColor,
          noticeboardPasscode,
          siteDomain,
          defaultZoomId,
          defaultZoomPasscode,
          roleEntries,
        }),
      });
      if (res.ok) {
        toast({ title: t("settingsSaved", language) });
        onSaved?.();
      } else if (res.status === 403) {
        setForbidden(true);
        toast({
          title: "Forbidden",
          description: "Only super admins can change congregation details.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error saving settings", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error saving settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dayLabel = (value: string) => {
    const d = DAYS.find((day) => day.value === value);
    return d ? d.label : "—";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const showAll = section === "all";

  return (
    <div className="space-y-6">
      {forbidden && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You can view these settings, but only an admin can change them.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Congregation Identity — shown in display section */}
      {(showAll || section === "display") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              {t("congregationTitle", language)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              The congregation name displayed on the noticeboard.
            </p>
          </CardHeader>
          <CardContent>
            <Input
              value={congregationTitle}
              onChange={(e) => setCongregationTitle(e.target.value)}
              placeholder={t("congregationTitlePlaceholder", language)}
            />
            <div className="space-y-2 pt-3">
              <Label>Site Domain (for sharing)</Label>
              <Input
                value={siteDomain}
                onChange={(e) => setSiteDomain(e.target.value)}
                placeholder="e.g. https://noticeboard.example.com"
                className="rounded-lg"
              />
              <p className="text-[11px] text-muted-foreground">
                When set, share links will use this domain instead of the current browser URL. Include https:// or http://.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Congregation Meeting Schedule — shown in meetings section */}
      {(showAll || section === "meetings") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              {t("meetingSettings", language)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Set the days and times for congregation meetings.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Midweek */}
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold">{t("midweekMeeting", language)}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("midweekDay", language)}</Label>
                  <Select value={midweekDay} onValueChange={setMidweekDay}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("midweekTime", language)}</Label>
                  <Input
                    type="time"
                    value={midweekTime}
                    onChange={(e) => setMidweekTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Weekend */}
            <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold">{t("weekendMeeting", language)}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("weekendDay", language)}</Label>
                  <Select value={weekendDay} onValueChange={setWeekendDay}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("weekendTime", language)}</Label>
                  <Input
                    type="time"
                    value={weekendTime}
                    onChange={(e) => setWeekendTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("meetingLocation", language)}</Label>
              <Input
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Display Settings — shown in display section */}
      {(showAll || section === "display") && (
        <Card>
          <CardHeader>
            <CardTitle>{t("displaySettings", language)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Calendar Start Day</Label>
              <Select value={calendarStartDay} onValueChange={setCalendarStartDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Which day the calendar week starts on (default: Monday).
              </p>
            </div>

            {/* Top Bar & Side Bar Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Top Bar Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={topBarColor || "#ffffff"}
                    onChange={(e) => setTopBarColor(e.target.value)}
                    className="h-9 w-12 rounded-lg border border-border/40 cursor-pointer"
                  />
                  <Input
                    value={topBarColor}
                    onChange={(e) => setTopBarColor(e.target.value)}
                    placeholder="#ffffff"
                    className="rounded-lg text-xs font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-lg text-xs"
                    onClick={() => setTopBarColor("")}
                  >
                    Default
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Background color of the top header bar. Leave empty for default.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Side Bar Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={sideBarColor || "#ffffff"}
                    onChange={(e) => setSideBarColor(e.target.value)}
                    className="h-9 w-12 rounded-lg border border-border/40 cursor-pointer"
                  />
                  <Input
                    value={sideBarColor}
                    onChange={(e) => setSideBarColor(e.target.value)}
                    placeholder="#ffffff"
                    className="rounded-lg text-xs font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-lg text-xs"
                    onClick={() => setSideBarColor("")}
                  >
                    Default
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Background color of the left sidebar. Leave empty for default.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Settings — shown in display section */}
      {(showAll || section === "display") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-600" />
              Noticeboard Passcode
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Set a passcode that visitors must enter before viewing the noticeboard. Logged-in users bypass this.
            </p>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              value={noticeboardPasscode}
              onChange={(e) => setNoticeboardPasscode(e.target.value)}
              placeholder="Leave empty for no passcode"
              className="rounded-lg"
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              When set, anyone visiting the noticeboard who is not logged in will be asked to enter this passcode.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Zoom Default Settings — shown in meetings section */}
      {(showAll || section === "meetings") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-indigo-600" />
              Default Zoom Details
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Default Zoom meeting ID and passcode for meetings. These show up when clicking a meeting on the calendar.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Zoom Meeting ID</Label>
              <Input
                value={defaultZoomId}
                onChange={(e) => setDefaultZoomId(e.target.value)}
                placeholder="e.g. 1234567890"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Zoom Passcode</Label>
              <Input
                value={defaultZoomPasscode}
                onChange={(e) => setDefaultZoomPasscode(e.target.value)}
                placeholder="e.g. 123456"
                className="rounded-lg"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              These defaults apply to all meetings. Individual special events can have their own Zoom details.
            </p>
          </CardContent>
        </Card>
      )}

      {(showAll || section === "conventions") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-green-600" />
              Convention Default Days
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Default days for conventions and circuit assemblies (e.g. Friday–Sunday).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Day</Label>
                <Select value={conventionStartDay} onValueChange={setConventionStartDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Day</Label>
                <Select value={conventionEndDay} onValueChange={setConventionEndDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              When a convention or circuit assembly is added, these days will be used as defaults for the date range.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Map Settings — shown in map section */}
      {(showAll || section === "map") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-600" />
              {t("mapSettings", language)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Show the Kingdom Hall location on the noticeboard.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("mapAddress", language)}</Label>
              <LocationPicker
                location={mapAddress}
                latitude={mapLat !== "" ? parseFloat(mapLat) : null}
                longitude={mapLng !== "" ? parseFloat(mapLng) : null}
                onChange={(data) => {
                  setMapAddress(data.location);
                  setMapLat(data.latitude != null ? String(data.latitude) : "");
                  setMapLng(data.longitude != null ? String(data.longitude) : "");
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Search for the Kingdom Hall, drop a pin on the map, or paste coordinates copied from Google Maps.
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("mapEmbedUrl", language)} <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={mapEmbedUrl}
                onChange={(e) => setMapEmbedUrl(e.target.value)}
                placeholder={t("mapEmbedUrlPlaceholder", language)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("mapEmbedHint", language)} If set, the embed is shown instead of the interactive map.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current summary — shown in meetings section */}
      {(showAll || section === "meetings") && (
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200/50 dark:border-indigo-800/40">
          <CardContent className="py-4">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-3 uppercase tracking-wider">
              Current Schedule
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-indigo-100 dark:border-indigo-900/50">
                <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("midweekMeeting", language)}</p>
                  <p className="text-sm font-semibold">{dayLabel(midweekDay)}</p>
                  <p className="text-xs text-indigo-600 font-medium">{midweekTime || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-indigo-100 dark:border-indigo-900/50">
                <Users className="h-4 w-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("weekendMeeting", language)}</p>
                  <p className="text-sm font-semibold">{dayLabel(weekendDay)}</p>
                  <p className="text-xs text-green-600 font-medium">{weekendTime || "—"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meeting Overrides — shown in meetings section */}
      {(showAll || section === "meetings") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarX className="h-5 w-5 text-red-500" />
                Cancel / Reschedule Meetings
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setShowOverrideForm(!showOverrideForm)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Override
              </Button>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cancel or temporarily change the date/time of a specific meeting. Optionally creates a notice on the board.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Override form */}
            {showOverrideForm && (
              <div className="rounded-xl border border-border/40 p-4 space-y-3 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meeting Date</Label>
                    <Input type="date" value={overrideDate} onChange={(e) => {
                      setOverrideDate(e.target.value);
                      // Auto-detect meeting type based on day of week
                      if (e.target.value) {
                        const dow = new Date(e.target.value + "T00:00:00").getDay();
                        const mwDay = parseInt(midweekDay, 10);
                        const weDay = parseInt(weekendDay, 10);
                        if (dow === weDay) setOverrideMeetingType("weekend");
                        else setOverrideMeetingType("midweek");
                      }
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meeting Type</Label>
                    <Select value={overrideMeetingType} onValueChange={setOverrideMeetingType}>
                      <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="midweek">Midweek</SelectItem>
                        <SelectItem value="weekend">Weekend</SelectItem>
                      </SelectContent>
                    </Select>
                    {overrideDate && (() => {
                      const dow = new Date(overrideDate + "T00:00:00").getDay();
                      const mwDay = parseInt(midweekDay, 10);
                      const weDay = parseInt(weekendDay, 10);
                      if (dow !== mwDay && dow !== weDay) {
                        return <p className="text-[10px] text-amber-600">No regular meeting on this day</p>;
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setOverrideIsCancelled(true)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${overrideIsCancelled ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "border-border/40 hover:bg-accent"}`}
                  >
                    <XCircle className="h-4 w-4 inline mr-1" />
                    Cancel Meeting
                  </button>
                  <button
                    onClick={() => setOverrideIsCancelled(false)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${!overrideIsCancelled ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "border-border/40 hover:bg-accent"}`}
                  >
                    <Clock className="h-4 w-4 inline mr-1" />
                    Reschedule
                  </button>
                </div>

                {!overrideIsCancelled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">New Day</Label>
                      <Select value={overrideDay} onValueChange={setOverrideDay}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Same day" /></SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">New Time</Label>
                      <Input type="time" value={overrideTime} onChange={(e) => setOverrideTime(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Reason / Description</Label>
                  <Textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    rows={2}
                    placeholder={overrideIsCancelled ? "e.g. No meeting due to convention" : "e.g. Moved to Sunday due to public holiday"}
                    className="rounded-lg"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideCreateNotice}
                    onChange={(e) => setOverrideCreateNotice(e.target.checked)}
                    className="rounded"
                  />
                  Create a notice on the board about this
                </label>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setShowOverrideForm(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700"
                    disabled={!overrideDate || overrideSaving}
                    onClick={async () => {
                      setOverrideSaving(true);
                      try {
                        const res = await fetch("/api/meeting-overrides", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            date: overrideDate,
                            meetingType: overrideMeetingType,
                            originalDay: parseInt(overrideMeetingType === "midweek" ? midweekDay : weekendDay, 10),
                            isCancelled: overrideIsCancelled,
                            overrideDay: overrideDay ? parseInt(overrideDay, 10) : null,
                            overrideTime: overrideTime || null,
                            reason: overrideReason,
                            createNotice: overrideCreateNotice,
                          }),
                        });
                        if (res.ok) {
                          toast({ title: overrideIsCancelled ? "Meeting cancelled" : "Meeting rescheduled" });
                          setShowOverrideForm(false);
                          setOverrideDate("");
                          setOverrideReason("");
                          setOverrideTime("");
                          setOverrideDay("");
                          fetchOverrides();
                        } else {
                          toast({ title: "Error", variant: "destructive" });
                        }
                      } catch {
                        toast({ title: "Error", variant: "destructive" });
                      } finally {
                        setOverrideSaving(false);
                      }
                    }}
                  >
                    {overrideSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Save Override
                  </Button>
                </div>
              </div>
            )}

            {/* Existing overrides list */}
            {overrides.length > 0 && (
              <div className="space-y-2">
                {overrides.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${o.isCancelled ? "bg-red-100 text-red-600 dark:bg-red-950/30" : "bg-amber-100 text-amber-600 dark:bg-amber-950/30"}`}>
                      {o.isCancelled ? <XCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {o.meetingType === "midweek" ? "Midweek" : "Weekend"} Meeting — {o.isCancelled ? "CANCELLED" : "Rescheduled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {!o.isCancelled && o.overrideDay !== null && o.overrideDay !== undefined && ` → ${DAYS.find(d => d.value === String(o.overrideDay))?.label || ""}`}
                        {!o.isCancelled && o.overrideTime && ` at ${o.overrideTime}`}
                      </p>
                      {o.reason && <p className="text-xs text-muted-foreground truncate mt-0.5">{o.reason}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-600"
                      onClick={async () => {
                        await fetch(`/api/meeting-overrides?date=${o.date}&meetingType=${o.meetingType}`, { method: "DELETE" });
                        fetchOverrides();
                        toast({ title: "Override removed" });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save button — sticky at bottom */}
      <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-card border-t border-border/40 flex justify-end gap-2 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          {t("saveSettings", language)}
        </Button>
      </div>
    </div>
  );
}
