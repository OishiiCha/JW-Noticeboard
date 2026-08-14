"use client";

import { useState, useCallback, useEffect } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, Loader2, BookOpen, Mic, ClipboardPaste, ChevronDown, ChevronUp, Copy, AlertTriangle, Calendar, Trash2 } from "lucide-react";
import { FileUploadZone } from "@/components/shared/file-upload-zone";
import { WeekSelector } from "@/components/shared/week-selector";
import { AdvancedOptions, type AdvancedOptionsState } from "@/components/shared/advanced-options";
import { useToast } from "@/hooks/use-toast";

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  variant: "midweek" | "public-talk";
  categories: { id: string; name: string }[];
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MeetingEntry {
  date: string;
  content: string;
  fields?: { key: string; value: string }[];
}

// Color mapping for schedule fields
const FIELD_COLORS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Speaker: { label: "Speaker", bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800/40" },
  Congregation: { label: "Congregation", bg: "bg-cyan-100 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800/40" },
  TalkTheme: { label: "Talk Theme", bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800/40" },
  Chairman: { label: "Chairman", bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800/40" },
  Prayer: { label: "Prayer", bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800/40" },
  WTStudyReader: { label: "WT Study Reader", bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/40" },
  // Midweek meeting fields
  BibleReading: { label: "Bible Reading", bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800/40" },
  TreasuresTalk: { label: "Treasures Talk", bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800/40" },
  TreasuresGem: { label: "Treasures Gem", bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800/40" },
  ApplyYourself1: { label: "Apply Yourself #1", bg: "bg-teal-100 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800/40" },
  ApplyYourself2: { label: "Apply Yourself #2", bg: "bg-teal-100 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800/40" },
  LivingTalk: { label: "Living Talk", bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800/40" },
  CongregationBibleStudy: { label: "Congregation Bible Study", bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/40" },
  Reader: { label: "Reader", bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800/40" },
};

const DEFAULT_FIELD_COLOR = { label: "", bg: "bg-slate-100 dark:bg-slate-950/40", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40" };

function getFieldColor(key: string) {
  return FIELD_COLORS[key] || { ...DEFAULT_FIELD_COLOR, label: key };
}

// Parse content string "Key: Value\nKey: Value" into structured fields
function parseFields(content: string): { key: string; value: string }[] {
  return content.split("\n").map(line => {
    const idx = line.indexOf(":");
    if (idx > 0) {
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    }
    return { key: line.trim(), value: "" };
  }).filter(f => f.key);
}

// Convert structured fields back to content string
function fieldsToContent(fields: { key: string; value: string }[]): string {
  return fields.map(f => f.value.trim() ? `${f.key}: ${f.value}` : f.key).join("\n");
}

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

// Snap a date to the nearest meeting day (0=Sunday, 6=Saturday)
function snapToMeetingDay(dateStr: string, meetingDay: number): string {
  const d = new Date(dateStr + "T00:00:00");
  const currentDay = d.getDay();
  let diff = meetingDay - currentDay;
  if (diff < -3) diff += 7;
  if (diff > 3) diff -= 7;
  d.setDate(d.getDate() + diff);
  return toYMD(d);
}

export function ScheduleModal({ open, onClose, onSaved, variant, categories }: ScheduleModalProps) {
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("");
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [options, setOptions] = useState<AdvancedOptionsState>({
    isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null,
  });
  const [saving, setSaving] = useState(false);
  const [meetingDay, setMeetingDay] = useState(2);
  const [meetingTime, setMeetingTime] = useState("18:30");
  const [meetingEntries, setMeetingEntries] = useState<MeetingEntry[]>([]);
  const [manualText, setManualText] = useState("");
  const [showAiPaste, setShowAiPaste] = useState(false);
  const [aiPasteText, setAiPasteText] = useState("");

  // AI-parsed entries with their own dates (like roles modal)
  const [aiEntries, setAiEntries] = useState<MeetingEntry[]>([]);
  const [entriesFromAi, setEntriesFromAi] = useState(false);

  // Date conflict dialog
  const [showDateConflict, setShowDateConflict] = useState(false);
  const [dateConflicts, setDateConflicts] = useState<{ date: string; expectedDay: string; actualDay: string }[]>([]);
  const [pendingAiEntries, setPendingAiEntries] = useState<MeetingEntry[]>([]);

  const isMidweek = variant === "midweek";
  const title = isMidweek ? "Midweek Meeting Schedule" : "Public Talk Schedule";
  const Icon = isMidweek ? BookOpen : Mic;

  const aiPromptTemplate = isMidweek
    ? `Convert the following midweek meeting schedule image into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "BibleReading": "{Name}",\n    "TreasuresTalk": "{Name}",\n    "TreasuresGem": "{Name}",\n    "ApplyYourself1": "{Name}",\n    "ApplyYourself2": "{Name}",\n    "LivingTalk": "{Name}",\n    "CongregationBibleStudy": "{Name}",\n    "Reader": "{Name}",\n    "Prayer": "{Name}"\n  }\n]\n\nReturn ONLY the JSON array, one object per meeting date. If there are multiple dates in the image, include multiple objects in the array.`
    : `Convert the following public talk schedule image into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "Speaker": "{Name}",\n    "Congregation": "{Congregation Name}",\n    "TalkTheme": "{Theme Number or Title}",\n    "Chairman": "{Name}",\n    "Prayer": "{Name}",\n    "WTStudyReader": "{Name}"\n  }\n]\n\nReturn ONLY the JSON array, one object per meeting date. If there are multiple dates in the image, include multiple objects in the array.`;

  useEffect(() => {
    if (open) {
      fetch("/api/settings").then(res => res.ok ? res.json() : {}).then((data: Record<string, unknown>) => {
        if (isMidweek) {
          if (data.midweekDay !== undefined) setMeetingDay(Number(data.midweekDay));
          if (data.midweekTime !== undefined) setMeetingTime(String(data.midweekTime));
        } else {
          if (data.weekendDay !== undefined) setMeetingDay(Number(data.weekendDay));
          if (data.weekendTime !== undefined) setMeetingTime(String(data.weekendTime));
        }
      }).catch(() => {});
    }
  }, [open, isMidweek]);

  useScrollLock(open);

  // Only derive meetingEntries from manualText + selectedWeeks when NOT using AI entries
  useEffect(() => {
    if (entriesFromAi) return; // AI entries manage themselves
    if (manualText && selectedWeeks.length > 0) {
      const lines = manualText.split("\n");
      const entries: MeetingEntry[] = [];
      let currentText: string[] = [];

      for (const line of lines) {
        const dateMatch = line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/i);
        const dayMatch = DAY_NAMES.some(d => line.toLowerCase().includes(d.toLowerCase())) && line.length < 30;

        if (dateMatch || (dayMatch && currentText.length > 0)) {
          if (currentText.length > 0) {
            entries.push({ date: "", content: currentText.join("\n").trim() });
          }
          currentText = [line];
        } else {
          currentText.push(line);
        }
      }
      if (currentText.length > 0) {
        entries.push({ date: "", content: currentText.join("\n").trim() });
      }

      if (entries.length <= 1) {
        const fullText = manualText;
        setMeetingEntries(selectedWeeks.map((weekDate) => {
          const monday = new Date(weekDate + "T00:00:00");
          const meetingDate = new Date(monday);
          meetingDate.setDate(monday.getDate() + meetingDay);
          return { date: toYMD(meetingDate), content: fullText };
        }));
      } else {
        setMeetingEntries(selectedWeeks.map((weekDate, idx) => {
          const monday = new Date(weekDate + "T00:00:00");
          const meetingDate = new Date(monday);
          meetingDate.setDate(monday.getDate() + meetingDay);
          const entry = entries[idx] || entries[0];
          return { date: toYMD(meetingDate), content: entry?.content || "" };
        }));
      }
    }
  }, [manualText, selectedWeeks, meetingDay, entriesFromAi]);

  const handleUpload = useCallback((result: { url: string; fileName: string; type: string }) => {
    setFileUrl(result.url);
    setFileName(result.fileName);
    setFileType(result.type);
    setMeetingEntries([]);
    setEntriesFromAi(false);
    setAiEntries([]);
  }, []);

  const resetForm = () => {
    setFileUrl(null); setFileName(null); setFileType(""); setSelectedWeeks([]);
    setOptions({ isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null });
    setMeetingEntries([]); setManualText("");
    setShowAiPaste(false); setAiPasteText("");
    setAiEntries([]); setEntriesFromAi(false);
    setShowDateConflict(false); setDateConflicts([]); setPendingAiEntries([]);
  };

  const updateEntryContent = (idx: number, content: string) => {
    if (entriesFromAi) {
      setAiEntries(prev => prev.map((e, i) => i === idx ? { ...e, content, fields: parseFields(content) } : e));
    } else {
      setMeetingEntries(prev => prev.map((e, i) => i === idx ? { ...e, content } : e));
    }
  };

  const updateEntryDate = (idx: number, date: string) => {
    setAiEntries(prev => prev.map((e, i) => i === idx ? { ...e, date } : e));
  };

  const updateEntryField = (idx: number, fieldIdx: number, value: string) => {
    setAiEntries(prev => prev.map((e, i) => {
      if (i !== idx || !e.fields) return e;
      const newFields = e.fields.map((f, fi) => fi === fieldIdx ? { ...f, value } : f);
      return { ...e, fields: newFields, content: fieldsToContent(newFields) };
    }));
  };

  const removeEntry = (idx: number) => {
    setAiEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const parseAiOutput = () => {
    if (!aiPasteText.trim()) return;

    let parsedEntries: MeetingEntry[] = [];

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    let cleanText = aiPasteText.trim();
    cleanText = cleanText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    // Try JSON parsing first
    try {
      const parsed = JSON.parse(cleanText);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        parsedEntries = parsed.map((obj: Record<string, string>) => {
          const dateStr = obj.Date || obj.date || "";
          const parsedDate = parseDateFromText(dateStr) || dateStr;
          const fields = Object.entries(obj)
            .filter(([k]) => k.toLowerCase() !== "date")
            .map(([k, v]) => ({ key: k, value: String(v || "") }));
          const content = fields.map(f => f.value.trim() ? `${f.key}: ${f.value}` : f.key).join("\n");
          return { date: parsedDate, content, fields };
        });
      }
    } catch {
      // Not valid JSON, fall through to text parsing
    }

    // Fallback: text-based parsing (split by date-like lines)
    if (parsedEntries.length === 0) {
      const lines = aiPasteText.split("\n");
      let currentDate: string | null = null;
      let currentContent: string[] = [];

      for (const line of lines) {
        const dateMatch = line.match(/^(?:Date:\s*)?(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i);
        if (dateMatch) {
          if (currentDate && currentContent.length > 0) {
            parsedEntries.push({ date: currentDate, content: currentContent.join("\n").trim() });
          }
          const rawDate = dateMatch[1];
          const parsed = parseDateFromText(rawDate);
          currentDate = parsed || rawDate;
          currentContent = line.includes(":") && !line.match(/^Date:/i) ? [line] : [];
        } else if (line.trim()) {
          currentContent.push(line);
        }
      }
      if (currentDate && currentContent.length > 0) {
        const content = currentContent.join("\n").trim();
        parsedEntries.push({ date: currentDate, content, fields: parseFields(content) });
      }
    }

    if (parsedEntries.length === 0) {
      // Just use the raw text as a single entry
      setManualText(aiPasteText.trim());
      setEntriesFromAi(false);
    } else {
      // Sort by date ascending
      parsedEntries.sort((a, b) => a.date.localeCompare(b.date));

      // Check if dates match the meeting day
      const conflicts: { date: string; expectedDay: string; actualDay: string }[] = [];
      for (const entry of parsedEntries) {
        if (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
          const dayOfWeek = new Date(entry.date + "T00:00:00").getDay();
          if (dayOfWeek !== meetingDay) {
            conflicts.push({
              date: entry.date,
              expectedDay: DAY_NAMES[meetingDay],
              actualDay: DAY_NAMES[dayOfWeek],
            });
          }
        }
      }

      if (conflicts.length > 0) {
        // Show conflict dialog
        setPendingAiEntries(parsedEntries);
        setDateConflicts(conflicts);
        setShowDateConflict(true);
      } else {
        // No conflicts — apply directly
        setAiEntries(parsedEntries);
        setEntriesFromAi(true);
        setManualText("");
        setSelectedWeeks([]); // AI entries have their own dates, no need for week selector
      }
    }

    setShowAiPaste(false);
    setAiPasteText("");
    toast({ title: `Parsed ${parsedEntries.length || 1} entr${(parsedEntries.length || 1) === 1 ? "y" : "ies"} from AI output` });
  };

  const resolveDateConflicts = (usePastedDates: boolean) => {
    const resolved = usePastedDates
      ? pendingAiEntries
      : pendingAiEntries.map(e => ({
          date: snapToMeetingDay(e.date, meetingDay),
          content: e.content,
        }));

    setAiEntries(resolved);
    setEntriesFromAi(true);
    setManualText("");
    setSelectedWeeks([]);
    setShowDateConflict(false);
    setDateConflicts([]);
    setPendingAiEntries([]);
    toast({
      title: usePastedDates
        ? `Using pasted dates (${resolved.length} entries)`
        : `Snapped ${resolved.length} entries to ${DAY_NAMES[meetingDay]}`,
    });
  };

  // The entries currently being displayed/edited
  const displayEntries = entriesFromAi ? aiEntries : meetingEntries;

  const handleSave = async () => {
    // AI entries don't need a file upload; manual mode needs both file + weeks
    if (entriesFromAi ? aiEntries.length === 0 : (!fileUrl || selectedWeeks.length === 0)) return;
    setSaving(true);
    const category = categories.find(c => c.name === "Meetings");
    try {
      if (entriesFromAi && aiEntries.length > 0) {
        // Create a separate notice per AI entry (like roles modal does per week)
        const sorted = [...aiEntries].sort((a, b) => a.date.localeCompare(b.date));
        for (const entry of sorted) {
          if (!entry.date) continue;
          const d = new Date(entry.date + "T00:00:00");
          const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const content = entry.content?.trim() || "";
          const noticeTitle = `${title} — ${dateLabel}`;
          const description = content
            ? `${isMidweek ? "Midweek meeting" : "Public talk"} schedule for ${dateLabel}\n\n${content}`
            : `${isMidweek ? "Midweek meeting" : "Public talk"} schedule for ${dateLabel}`;

          const res = await fetch("/api/notices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: noticeTitle,
              description,
              content: content || undefined,
              type: fileUrl ? "file" : "text",
              fileUrl: fileUrl || undefined,
              fileName: fileName || undefined,
              thumbnailUrl: fileUrl && !fileType.includes("pdf") ? fileUrl : null,
              isPinned: options.isPinned, isPublished: true, isPublic: true,
              language: "en", showOnCalendar: options.showOnCalendar,
              eventStartDate: entry.date,
              eventEndDate: entry.date,
              categoryId: category?.id || null,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error || `Failed to post (HTTP ${res.status})`;
            if (res.status === 401) {
              toast({ title: "Authentication required", description: "Please log in and try again.", variant: "destructive" });
            } else {
              toast({ title: "Failed to post schedule", description: msg, variant: "destructive" });
            }
            return;
          }
        }
      } else {
        // Manual mode: single notice with combined content (existing behavior)
        const useOcrEntries = meetingEntries.length > 0 && meetingEntries.some(e => e.content.trim());
        const sortedWeeks = [...selectedWeeks].sort();
        const firstDate = new Date(sortedWeeks[0] + "T00:00:00");
        const lastMonday = new Date(sortedWeeks[sortedWeeks.length - 1] + "T00:00:00");
        const lastDate = new Date(lastMonday);
        lastDate.setDate(lastDate.getDate() + 6);

        const allOcrContent = useOcrEntries
          ? sortedWeeks.map((weekDate, i) => {
              const monday = new Date(weekDate + "T00:00:00");
              const meetingDate = new Date(monday);
              meetingDate.setDate(monday.getDate() + meetingDay);
              const meetingLabel = `${DAY_NAMES[meetingDay]} ${meetingDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
              const entry = meetingEntries[i];
              const content = entry?.content?.trim() || "";
              return content ? `${meetingLabel}\n${content}` : "";
            }).filter(Boolean).join("\n\n")
          : "";

        const dateRangeLabel = `${firstDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        const noticeTitle = `${title} — ${dateRangeLabel}`;
        const description = allOcrContent
          ? `${isMidweek ? "Midweek meeting" : "Public talk"} schedule for ${dateRangeLabel}\n\n${allOcrContent}`
          : `${isMidweek ? "Midweek meeting" : "Public talk"} schedule for ${dateRangeLabel}`;

        const res = await fetch("/api/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: noticeTitle,
            description,
            content: allOcrContent || undefined,
            type: fileUrl ? "file" : "text",
            fileUrl: fileUrl || undefined,
            fileName: fileName || undefined,
            thumbnailUrl: fileUrl && !fileType.includes("pdf") ? fileUrl : null,
            isPinned: options.isPinned, isPublished: true, isPublic: true,
            language: "en", showOnCalendar: options.showOnCalendar,
            eventStartDate: toYMD(firstDate),
            eventEndDate: toYMD(lastDate),
            categoryId: category?.id || null,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err.error || `Failed to post (HTTP ${res.status})`;
          if (res.status === 401) {
            toast({ title: "Authentication required", description: "Please log in and try again.", variant: "destructive" });
          } else {
            toast({ title: "Failed to post schedule", description: msg, variant: "destructive" });
          }
          return;
        }
      }

      const count = entriesFromAi ? aiEntries.length : 1;
      toast({ title: `Schedule posted (${count} ${count === 1 ? "entry" : "entries"})` });
      onSaved(); onClose(); resetForm();
    } catch {
      toast({ title: "Error saving", description: "Network error — please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const canSave = entriesFromAi ? aiEntries.length > 0 : (fileUrl && selectedWeeks.length > 0);

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border/40 rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white ${isMidweek ? "bg-blue-500" : "bg-purple-500"}`}>
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <FileUploadZone onUpload={handleUpload} onClear={() => { setFileUrl(null); setFileName(null); }} fileUrl={fileUrl} fileName={fileName} folder="schedules" />

          {/* AI Prompt: Copy template + Paste AI output */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowAiPaste(!showAiPaste)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAiPaste ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <ClipboardPaste className="h-3.5 w-3.5" />
              AI Prompt & Paste
            </button>
            {showAiPaste && (
              <div className="space-y-3 rounded-xl border border-border/40 p-3 bg-muted/10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">
                      Copy this prompt and paste it into an AI model with your schedule image:
                    </p>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap rounded-lg border border-border/40 bg-background p-2 overflow-x-auto max-h-48 overflow-y-auto">
                      {aiPromptTemplate}
                    </pre>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(aiPromptTemplate).then(() => toast({ title: "AI prompt copied to clipboard" }));
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy AI Prompt
                </Button>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Paste AI JSON Output Here</Label>
                  <Textarea
                    value={aiPasteText}
                    onChange={(e) => setAiPasteText(e.target.value)}
                    rows={8}
                    placeholder="Paste the AI model's JSON output here. It will be split by date into separate meeting entries."
                    className="rounded-lg text-sm font-mono"
                  />
                  <Button
                    size="sm"
                    className="rounded-lg w-full bg-teal-600 hover:bg-teal-700"
                    onClick={parseAiOutput}
                    disabled={!aiPasteText.trim()}
                  >
                    <ClipboardPaste className="h-3.5 w-3.5 mr-1" /> Parse & Fill Schedule
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* AI-parsed entries — shown as colored cards with structured fields */}
          {entriesFromAi && aiEntries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Parsed entries ({aiEntries.length}):
                </Label>
                <button
                  type="button"
                  onClick={() => { setEntriesFromAi(false); setAiEntries([]); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear & use manual
                </button>
              </div>
              {aiEntries.map((entry, idx) => {
                const d = entry.date ? new Date(entry.date + "T00:00:00") : null;
                const dayName = d ? DAY_NAMES[d.getDay()] : "";
                const isCorrectDay = d && d.getDay() === meetingDay;
                const dateLabel = d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "No date";
                const fields = entry.fields || parseFields(entry.content);
                return (
                  <div key={idx} className={`rounded-2xl border-2 p-3 space-y-2.5 transition-all ${isCorrectDay ? `${isMidweek ? "border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10" : "border-purple-200 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/10"}` : "border-amber-300 dark:border-amber-700/50 bg-amber-50/30 dark:bg-amber-950/10"}`}>
                    {/* Date header bar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white ${isMidweek ? "bg-blue-500" : "bg-purple-500"}`}>
                          {isMidweek ? "MW" : "PT"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold leading-tight">{dateLabel}</span>
                          {!isCorrectDay && d && (
                            <span className="text-[10px] text-amber-600 font-medium">Expected {DAY_NAMES[meetingDay]}</span>
                          )}
                        </div>
                      </div>
                      <Input
                        type="date"
                        value={entry.date}
                        onChange={(e) => updateEntryDate(idx, e.target.value)}
                        className="rounded-lg text-xs h-8 flex-shrink-0 w-[130px]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-500 shrink-0"
                        onClick={() => removeEntry(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Structured fields with colors */}
                    <div className="space-y-1.5">
                      {fields.map((field, fieldIdx) => {
                        const colors = getFieldColor(field.key);
                        return (
                          <div key={fieldIdx} className={`flex items-center gap-2 rounded-lg border ${colors.border} ${colors.bg} px-2 py-1`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${colors.text} shrink-0 w-[110px]`}>
                              {colors.label || field.key}
                            </span>
                            <Input
                              value={field.value}
                              onChange={(e) => updateEntryField(idx, fieldIdx, e.target.value)}
                              placeholder="—"
                              className="rounded-md text-xs h-7 flex-1 min-w-0 border-transparent bg-background/50 focus-visible:border-border"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual text mode — only show when not using AI entries */}
          {!entriesFromAi && (manualText || fileUrl) && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Schedule text {fileUrl ? "(optional)" : ""}</Label>
              <Textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={4}
                placeholder="Paste the schedule text here, or use AI Prompt & Paste above. It will be split into per-meeting entries for each selected week."
                className="rounded-lg text-xs font-mono"
              />
              {meetingEntries.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Text per meeting ({meetingEntries.length}):
                  </Label>
                  {meetingEntries.map((entry, idx) => (
                    <div key={idx} className="rounded-lg border border-border/40 p-2 space-y-1">
                      <p className="text-xs font-medium text-indigo-600">
                        {DAY_NAMES[meetingDay]} {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      <Textarea
                        value={entry.content}
                        onChange={(e) => updateEntryContent(idx, e.target.value)}
                        rows={4}
                        className="rounded-lg text-xs font-mono"
                        placeholder="Text for this meeting..."
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Week selector — hidden when using AI entries (they have their own dates) */}
          {!entriesFromAi && (
            <WeekSelector
              selectedWeeks={selectedWeeks}
              onChange={setSelectedWeeks}
              meetingDay={meetingDay}
              label={`Which meeting(s) is this for? (${DAY_NAMES[meetingDay]} ${meetingTime})`}
            />
          )}
          <AdvancedOptions state={options} onChange={setOptions} showCalendar={true} />
        </div>
        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || saving} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Upload & Post {entriesFromAi && aiEntries.length > 1 ? `(${aiEntries.length} entries)` : selectedWeeks.length > 1 ? `(${selectedWeeks.length} weeks)` : ""}
          </Button>
        </div>
      </div>

      {/* Date Conflict Dialog */}
      {showDateConflict && (
        <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDateConflict(false)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-amber-500 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Date Mismatch</h3>
                <p className="text-xs text-muted-foreground">
                  {dateConflicts.length} of {pendingAiEntries.length} dates fall on {dateConflicts[0]?.expectedDay} (your meeting day).
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 max-h-40 overflow-y-auto space-y-1">
              {dateConflicts.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-mono">{c.date}</span>
                  <span className="text-muted-foreground">is a {c.actualDay}</span>
                  <span className="text-amber-600 font-medium ml-auto">expected {c.expectedDay}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700"
                onClick={() => resolveDateConflicts(true)}
              >
                Use pasted dates as-is
              </Button>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => resolveDateConflicts(false)}
              >
                Snap to nearest {DAY_NAMES[meetingDay]}
              </Button>
              <Button
                variant="ghost"
                className="rounded-lg text-xs"
                onClick={() => { setShowDateConflict(false); setDateConflicts([]); setPendingAiEntries([]); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
