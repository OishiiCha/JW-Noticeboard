"use client";

import { useState, useCallback, useEffect } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { X, Loader2, BookOpen, Mic, ClipboardPaste, ChevronDown, ChevronUp, Copy, Trash2, Wand2, Plus, List, Type, AlertTriangle } from "lucide-react";
import { FileUploadZone } from "@/components/shared/file-upload-zone";
import { WeekSelector } from "@/components/shared/week-selector";
import { AdvancedOptions, type AdvancedOptionsState } from "@/components/shared/advanced-options";
import { useToast } from "@/hooks/use-toast";
import { getFieldConfig, parseScheduleFields, fieldsToContent, sortFieldsByNum, MIDWEEK_FIELD_TEMPLATES, PUBLIC_TALK_FIELD_TEMPLATES } from "@/lib/schedule-field-config";

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  variant: "midweek" | "public-talk";
  categories: { id: string; name: string }[];
  aiEnabled?: boolean;
  // When set, the modal edits this existing notice instead of creating new ones
  editNotice?: {
    id: string;
    title: string;
    content: string | null;
    description: string | null;
    eventStartDate: string | null;
    eventEndDate: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
  } | null;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MeetingEntry {
  date: string;
  content: string;
  fields?: { key: string; value: string; num?: number }[];
  color?: string | null;
}

// What handleSave captured before potentially showing the conflict dialog
type PendingScheduleSave =
  | { mode: "ai"; entries: { date: string; content: string }[] }
  | { mode: "manual"; start: string; end: string; content: string };

// Parse content string into fields using the shared helper
function parseFields(content: string): { key: string; value: string }[] {
  return parseScheduleFields(content);
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

// Fix dates that have the wrong year (AI often guesses wrong year) — snap to current year
function fixDateYear(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const currentYear = new Date().getFullYear();
  const year = parseInt(dateStr.substring(0, 4), 10);
  if (year < currentYear - 1 || year > currentYear + 1) {
    // Way off — replace year
    return `${currentYear}${dateStr.substring(4)}`;
  }
  return dateStr;
}

// Parse AI object → fields. Prefers the "Parts" array format (explicit Number
// per part — the app sorts by it); falls back to the older flat format with
// "#N" embedded in values.
function fieldsFromAiObject(obj: Record<string, unknown>): { key: string; value: string; num?: number }[] {
  const parts = obj.Parts ?? obj.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    const fields = parts
      .map((p) => {
        const part = p as Record<string, unknown>;
        const key = String(part.Field ?? part.field ?? part.Key ?? part.key ?? "").trim();
        const name = String(part.Name ?? part.name ?? part.Value ?? part.value ?? "").trim();
        const detail = String(part.Detail ?? part.detail ?? "").trim();
        const rawNum = part.Number ?? part.number ?? part.No ?? part.no;
        const num = rawNum !== undefined && rawNum !== null && String(rawNum).trim() !== "" && !isNaN(Number(rawNum))
          ? Number(rawNum)
          : undefined;
        const value = detail ? (name ? `${name} (${detail})` : detail) : name;
        return { key, value, num };
      })
      .filter(f => f.key);
    return sortFieldsByNum(fields);
  }

  // Legacy flat format: { "BibleReading": "#3 Rey Montoya", ... }
  const rawFields = Object.entries(obj)
    .filter(([k]) => k.toLowerCase() !== "date" && k.toLowerCase() !== "color")
    .map(([k, v]) => {
      const value = String(v || "");
      const numMatch = value.match(/^#(\d+)\s*/);
      return numMatch
        ? { key: k, value: value.slice(numMatch[0].length), num: parseInt(numMatch[1], 10) }
        : { key: k, value };
    });
  return sortFieldsByNum(rawFields);
}

export function ScheduleModal({ open, onClose, onSaved, variant, categories, aiEnabled, editNotice }: ScheduleModalProps) {
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("");
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [options, setOptions] = useState<AdvancedOptionsState>({
    isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null, isPublished: true,
  });
  const [saving, setSaving] = useState(false);
  const [meetingDay, setMeetingDay] = useState(2);
  const [meetingTime, setMeetingTime] = useState("18:30");
  const [meetingEntries, setMeetingEntries] = useState<MeetingEntry[]>([]);
  const [manualText, setManualText] = useState("");
  const [manualEditMode, setManualEditMode] = useState<"list" | "raw">("list");
  const [showAiPaste, setShowAiPaste] = useState(false);
  const [aiPasteText, setAiPasteText] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [mode, setMode] = useState<"manual" | "ai">("ai");

  // Conflict resolution state
  const [existingSchedules, setExistingSchedules] = useState<{ id: string; eventStartDate: string; eventEndDate: string | null; title: string; content: string | null; description: string | null }[]>([]);
  const [conflicts, setConflicts] = useState<{ key: string; date: string; existing: { id: string; title: string; content: string | null } | null; newContent: string }[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, "override" | "skip" | "compare">>({});
  const [pendingSave, setPendingSave] = useState<PendingScheduleSave | null>(null);

  // AI-parsed entries with their own dates (like roles modal)
  const [aiEntries, setAiEntries] = useState<MeetingEntry[]>([]);
  const [entriesFromAi, setEntriesFromAi] = useState(false);

  const isMidweek = variant === "midweek";
  const title = isMidweek ? "Midweek Meeting Schedule" : "Public Talk Schedule";
  const Icon = isMidweek ? BookOpen : Mic;

  const currentYear = new Date().getFullYear();
  const aiPromptTemplate = isMidweek
    ? `You are analyzing a midweek meeting schedule image. The current year is ${currentYear}. Extract ALL meeting weeks shown in the image — there may be multiple weeks/dates.\n\nConvert each week into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "Parts": [\n      { "Number": 1, "Field": "TreasuresTalk", "Name": "{Name}", "Detail": "{part title/theme text if shown, otherwise empty}" },\n      { "Number": 2, "Field": "TreasuresGem", "Name": "{Name}", "Detail": "{...}" },\n      { "Number": 3, "Field": "BibleReading", "Name": "{Name}", "Detail": "" },\n      { "Number": 4, "Field": "ApplyYourself1", "Name": "{Student/Assistant}", "Detail": "{assignment title}" },\n      { "Number": 5, "Field": "ApplyYourself2", "Name": "{Student/Assistant}", "Detail": "" },\n      { "Number": 6, "Field": "ApplyYourself3", "Name": "{Student/Assistant}", "Detail": "" },\n      { "Number": 7, "Field": "LivingTalk", "Name": "{Name}", "Detail": "" },\n      { "Number": 8, "Field": "CongregationBibleStudy", "Name": "{Name}", "Detail": "" },\n      { "Number": 9, "Field": "Reader", "Name": "{Name}", "Detail": "" },\n      { "Number": 10, "Field": "Prayer", "Name": "{Name}", "Detail": "" }\n    ],\n    "Color": "{optional: background/highlight color of this section, hex or name}"\n  }\n]\n\nCRITICAL RULES:\n1. Return ONE object PER meeting date (4 weeks in the image = 4 objects).\n2. "Number" is the part number AS SHOWN on the image (use the printed number; if unnumbered, count sequentially 1, 2, 3...). The app sorts parts by this Number — it must be correct for every part.\n3. Use these Field names where they match: TreasuresTalk, TreasuresGem, BibleReading, ApplyYourself1, ApplyYourself2, ApplyYourself3, LivingTalk, CongregationBibleStudy, Reader, Prayer, Chairman. Include every part shown on the image even if not listed above (use the printed label as the Field name).\n4. Put the part's title/theme text in "Detail", the person name(s) in "Name".\n5. Use the current year (${currentYear}) unless the image clearly shows another year.\n6. Return ONLY the JSON array, no other text.`
    : `You are analyzing a public talk schedule image. The current year is ${currentYear}. Extract ALL meeting weeks shown in the image — there may be multiple weeks/dates.\n\nConvert each week into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "Parts": [\n      { "Number": 1, "Field": "Speaker", "Name": "{Name}", "Detail": "" },\n      { "Number": 2, "Field": "Congregation", "Name": "{Congregation}", "Detail": "" },\n      { "Number": 3, "Field": "TalkTheme", "Name": "{Theme title}", "Detail": "Talk #{talk number}" },\n      { "Number": 4, "Field": "Chairman", "Name": "{Name}", "Detail": "" },\n      { "Number": 5, "Field": "Prayer", "Name": "{Name}", "Detail": "" },\n      { "Number": 6, "Field": "WTStudyReader", "Name": "{Name}", "Detail": "" }\n    ]\n  }\n]\n\nCRITICAL RULES:\n1. Return ONE object PER meeting date (4 weeks in the image = 4 objects).\n2. "Number" is the part's position/number AS SHOWN on the image (if unnumbered, count sequentially 1, 2, 3...). The app sorts parts by this Number — it must be correct for every part.\n3. Use these Field names where they match: Speaker, Congregation, TalkTheme, Chairman, Prayer, WTStudyReader. Include every part shown on the image even if not listed above (use the printed label as the Field name).\n4. Put the talk theme number in "Detail" as "Talk #N" and the theme title in "Name".\n5. Use the current year (${currentYear}) unless the image clearly shows another year.\n6. Return ONLY the JSON array, no other text.`;

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

  // Fetch existing schedule notices for this variant so we can detect duplicate dates on save
  useEffect(() => {
    if (!open) return;
    fetch("/api/notices")
      .then(res => (res.ok ? res.json() : []))
      .then((notices: { id: string; title: string; content: string | null; description: string | null; eventStartDate: string | null; eventEndDate: string | null }[]) => {
        const prefix = isMidweek ? "Midweek Meeting Schedule" : "Public Talk Schedule";
        setExistingSchedules(
          notices
            .filter(n => n.eventStartDate && (n.title || "").startsWith(prefix))
            .map(n => ({
              id: n.id,
              eventStartDate: n.eventStartDate!.slice(0, 10),
              eventEndDate: n.eventEndDate ? n.eventEndDate.slice(0, 10) : null,
              title: n.title,
              content: n.content,
              description: n.description,
            }))
        );
      })
      .catch(() => {});
  }, [open, isMidweek]);

  // Edit mode: load the existing notice's fields into editable entries
  useEffect(() => {
    if (!open || !editNotice) return;
    const raw = editNotice.content || editNotice.description || "";
    const body = raw.replace(/^(Midweek meeting|Public talk)\s+schedule for\s+.+\s*\n/im, "");
    const singleDate = editNotice.eventStartDate
      ? (!editNotice.eventEndDate || editNotice.eventEndDate === editNotice.eventStartDate)
      : false;
    // Multi-week content is stored with "Thu Aug 20" style headers per meeting
    const dateHeaderRe = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w*,?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}/i;
    const chunks: { header: string | null; text: string[] }[] = [];
    let cur = { header: null as string | null, text: [] as string[] };
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (dateHeaderRe.test(t) && cur.text.length) {
        chunks.push(cur);
        cur = { header: t, text: [] };
      } else {
        cur.text.push(line);
      }
    }
    chunks.push(cur);

    const parsed: MeetingEntry[] = chunks
      .filter(c => c.text.join("").trim())
      .map(c => {
        const content = c.text.join("\n").trim();
        let date = c.header ? (parseDateFromText(c.header) || "") : "";
        if (!date && singleDate && editNotice.eventStartDate) date = editNotice.eventStartDate.slice(0, 10);
        return { date, content, fields: parseScheduleFields(content) };
      });
    parsed.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    setAiEntries(parsed);
    setEntriesFromAi(true);
    setMode("ai");
    if (editNotice.fileUrl) {
      setFileUrl(editNotice.fileUrl);
      setFileName(editNotice.fileName ?? null);
      setFileType(/\.pdf(\?|$)/i.test(editNotice.fileUrl) ? "application/pdf" : "image/*");
    }
  }, [open, editNotice]);

  useScrollLock(open);

  // Only derive meetingEntries from manualText + selectedWeeks when NOT using AI entries
  useEffect(() => {
    if (entriesFromAi && mode === "ai") return; // AI entries manage themselves
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
  }, [manualText, selectedWeeks, meetingDay, entriesFromAi, mode]);

  // Re-snap AI entry dates when meeting day changes
  useEffect(() => {
    if (!entriesFromAi || aiEntries.length === 0) return;
    setAiEntries(prev => prev.map(e => {
      if (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
        return { ...e, date: snapToMeetingDay(e.date, meetingDay) };
      }
      return e;
    }));
  }, [meetingDay, entriesFromAi]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setOptions({ isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null, isPublished: true });
    setMeetingEntries([]); setManualText(""); setManualEditMode("list");
    setShowAiPaste(false); setAiPasteText("");
    setAiEntries([]); setEntriesFromAi(false);
    setMode("ai");
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

  // ── Manual text list-mode helpers (add/remove/update fields) ──
  const updateManualField = (idx: number, fieldIdx: number, value: string) => {
    setMeetingEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const fields = parseFields(e.content);
      const newFields = fields.map((f, fi) => fi === fieldIdx ? { ...f, value } : f);
      return { ...e, content: fieldsToContent(newFields) };
    }));
  };

  const addManualField = (idx: number, key: string) => {
    setMeetingEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const fields = parseFields(e.content);
      fields.push({ key, value: "" });
      return { ...e, content: fieldsToContent(fields) };
    }));
  };

  const removeManualField = (idx: number, fieldIdx: number) => {
    setMeetingEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const fields = parseFields(e.content);
      fields.splice(fieldIdx, 1);
      return { ...e, content: fieldsToContent(fields) };
    }));
  };

  const updateManualFieldKey = (idx: number, fieldIdx: number, key: string) => {
    setMeetingEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const fields = parseFields(e.content);
      const newFields = fields.map((f, fi) => fi === fieldIdx ? { ...f, key } : f);
      return { ...e, content: fieldsToContent(newFields) };
    }));
  };

  const autoProcessWithAi = async () => {
    if (!fileUrl) {
      toast({ title: "Please upload a schedule image first", variant: "destructive" });
      return;
    }
    setAiProcessing(true);
    try {
      const res = await fetch("/api/ai-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: fileUrl, prompt: aiPromptTemplate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: data.error || "AI processing failed", variant: "destructive" });
        return;
      }
      const data = await res.json();
      const result = data.result || "";
      // Strip markdown code fences if present
      let cleanText = result.trim();
      cleanText = cleanText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      setAiPasteText(cleanText);
      // Auto-parse the result
      try {
        const parsed = JSON.parse(cleanText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const parsedEntries: MeetingEntry[] = parsed.map((obj: Record<string, string>) => {
            const dateStr = obj.Date || obj.date || "";
            const parsedDate = parseDateFromText(dateStr) || dateStr;
            const color = obj.Color || obj.color || null;
            // Fields sorted by their explicit part numbers
            const fields = fieldsFromAiObject(obj as Record<string, unknown>);
            const content = fieldsToContent(fields);
            // Fix wrong year then snap to meeting day
            const fixedDate = fixDateYear(parsedDate);
            const snappedDate = fixedDate && /^\d{4}-\d{2}-\d{2}$/.test(fixedDate)
              ? snapToMeetingDay(fixedDate, meetingDay)
              : fixedDate;
            return { date: snappedDate, content, fields, color };
          });
          parsedEntries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
          setAiEntries(parsedEntries);
          setEntriesFromAi(true);
          // AI results override any manual data entered so far
          setManualText("");
          setSelectedWeeks([]);
          setMeetingEntries([]);
          setShowAiPaste(true);
          toast({ title: `AI processed ${parsedEntries.length} entr${parsedEntries.length === 1 ? "y" : "ies"}!` });
        } else {
          toast({ title: "AI returned unexpected format", variant: "destructive" });
        }
      } catch {
        toast({ title: "AI returned invalid JSON", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to connect to AI service", variant: "destructive" });
    } finally {
      setAiProcessing(false);
    }
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
          const color = obj.Color || obj.color || null;
          // Fields sorted by their explicit part numbers
          const fields = fieldsFromAiObject(obj as Record<string, unknown>);
          const content = fieldsToContent(fields);
          // Fix wrong year then snap to meeting day
          const fixedDate = fixDateYear(parsedDate);
          const snappedDate = fixedDate && /^\d{4}-\d{2}-\d{2}$/.test(fixedDate)
            ? snapToMeetingDay(fixedDate, meetingDay)
            : fixedDate;
          return { date: snappedDate, content, fields, color };
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

      // Auto-apply (dates are already snapped to meeting day)
      setAiEntries(parsedEntries);
      setEntriesFromAi(true);
      setManualText("");
      setSelectedWeeks([]); // AI entries have their own dates, no need for week selector
    }

    setShowAiPaste(false);
    setAiPasteText("");
    toast({ title: `Parsed ${parsedEntries.length || 1} entr${(parsedEntries.length || 1) === 1 ? "y" : "ies"} from AI output` });
  };

  // The entries currently being displayed/edited
  const displayEntries = mode === "ai" && entriesFromAi ? aiEntries : meetingEntries;

  // Detect missing weeks: between the earliest and latest known schedule dates
  // (existing + new), flag any week with no meeting scheduled
  const missingWeeks = (() => {
    const newDates = displayEntries.map(e => e.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const dates = [...new Set([...newDates, ...existingSchedules.map(s => s.eventStartDate)])].sort();
    if (dates.length < 2) return [];
    const set = new Set(dates);
    const gaps: string[] = [];
    const end = new Date(dates[dates.length - 1] + "T00:00:00");
    for (let d = new Date(dates[0] + "T00:00:00"); d <= end; d.setDate(d.getDate() + 7)) {
      const ymd = toYMD(d);
      if (!set.has(ymd)) gaps.push(ymd);
    }
    return gaps;
  })();

  // AI entries are used only in AI mode — switching to Manual Entry keeps them
  // (so you can switch back) but saves the manual data
  const useAiEntries = mode === "ai" && entriesFromAi && aiEntries.length > 0;

  const handleSave = async () => {
    // AI entries don't need a file upload; manual mode needs both file + weeks
    if (useAiEntries ? aiEntries.length === 0 : (!fileUrl || selectedWeeks.length === 0)) return;

    // Build the pending payload (same shape executeSave will post)
    let pending: PendingScheduleSave;
    if (useAiEntries) {
      pending = {
        mode: "ai",
        entries: [...aiEntries].filter(e => e.date).sort((a, b) => a.date.localeCompare(b.date))
          .map(e => ({ date: e.date, content: e.content?.trim() || "" })),
      };
    } else {
      const { start, end, content } = buildManualPayload();
      pending = { mode: "manual", start, end, content };
    }

    // Detect duplicate dates against existing schedule notices of this variant
    // (not in edit mode — we're updating the same notice)
    if (!editNotice) {
      const found: { key: string; date: string; existing: { id: string; title: string; content: string | null } | null; newContent: string }[] = [];
      if (pending.mode === "ai") {
        for (const entry of pending.entries) {
          const ex = existingSchedules.find(s => s.eventStartDate <= entry.date && (s.eventEndDate || s.eventStartDate) >= entry.date);
          if (ex) {
            found.push({ key: entry.date, date: entry.date, existing: { id: ex.id, title: ex.title, content: ex.content }, newContent: entry.content });
          }
        }
      } else {
        for (const ex of existingSchedules) {
          if (ex.eventStartDate <= pending.end && (ex.eventEndDate || ex.eventStartDate) >= pending.start) {
            found.push({ key: ex.id, date: ex.eventStartDate, existing: { id: ex.id, title: ex.title, content: ex.content }, newContent: pending.content });
          }
        }
      }

      if (found.length > 0) {
        setConflicts(found);
        setConflictResolutions({});
        setPendingSave(pending);
        setShowConflictDialog(true);
        return;
      }
    }

    await executeSave(pending);
  };

  // Compute the manual-mode notice payload: date range + per-week OCR content
  const buildManualPayload = () => {
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

    return { start: toYMD(firstDate), end: toYMD(lastDate), content: allOcrContent };
  };

  const executeSave = async (pending: PendingScheduleSave, resolutions?: Record<string, "override" | "skip" | "compare">) => {
    setSaving(true);
    const category = categories.find(c => c.name === "Meetings");
    try {
      if (editNotice) {
        // Edit mode: rebuild the content from the edited entries and update the
        // existing notice. Description stays empty — the field list is the content.
        const entries = pending.mode === "ai" ? pending.entries : [];
        const single = entries.length === 1;
        const content = entries.map(entry => {
          const fc = fieldsToContent(parseScheduleFields(entry.content));
          if (single || !entry.date) return fc;
          const d = new Date(entry.date + "T00:00:00");
          return `${DAY_NAMES[d.getDay()]} ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}\n${fc}`;
        }).filter(Boolean).join("\n\n");

        const res = await fetch(`/api/notices/${editNotice.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editNotice.title,
            description: null,
            content: content || undefined,
            categoryId: category?.id ?? null,
            eventStartDate: single && entries[0]?.date ? entries[0].date : editNotice.eventStartDate,
            eventEndDate: single && entries[0]?.date ? entries[0].date : editNotice.eventEndDate,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({ title: "Failed to update schedule", description: err.error || `HTTP ${res.status}`, variant: "destructive" });
          return;
        }
      } else if (pending.mode === "ai") {
        for (const entry of pending.entries) {
          const resolution = resolutions?.[entry.date];
          if (resolution === "skip") continue;

          const d = new Date(entry.date + "T00:00:00");
          const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          const content = entry.content;
          const noticeTitle = `${title} — ${dateLabel}`;

          // Override: update the existing notice in place instead of
          // delete-then-create, so nothing is lost if the write fails
          if (resolution === "override") {
            const ex = existingSchedules.find(s => s.eventStartDate <= entry.date && (s.eventEndDate || s.eventStartDate) >= entry.date);
            if (ex) {
              const res = await fetch(`/api/notices/${ex.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: noticeTitle,
                  description: null,
                  content: content || undefined,
                  eventStartDate: entry.date,
                  eventEndDate: entry.date,
                  categoryId: category?.id ?? null,
                }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast({ title: "Failed to update schedule", description: err.error || `HTTP ${res.status}`, variant: "destructive" });
                return;
              }
              continue;
            }
          }

          const res = await fetch("/api/notices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: noticeTitle,
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
        // Manual mode: single notice covering the selected week range.
        const firstDate = new Date(pending.start + "T00:00:00");
        const lastDate = new Date(pending.end + "T00:00:00");
        const dateRangeLabel = `${firstDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        const noticeTitle = `${title} — ${dateRangeLabel}`;

        // Override: update the first conflicting notice in place with the new
        // data (and remove any additional overlaps), instead of delete-then-create
        const overrideIds = resolutions
          ? Object.keys(resolutions).filter(k => resolutions[k] === "override")
          : [];
        if (overrideIds.length > 0) {
          const res = await fetch(`/api/notices/${overrideIds[0]}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: noticeTitle,
              description: null,
              content: pending.content || undefined,
              eventStartDate: pending.start,
              eventEndDate: pending.end,
              categoryId: category?.id ?? null,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast({ title: "Failed to update schedule", description: err.error || `HTTP ${res.status}`, variant: "destructive" });
            return;
          }
          for (const extraId of overrideIds.slice(1)) {
            await fetch(`/api/notices/${extraId}`, { method: "DELETE" });
          }
        } else {
        const res = await fetch("/api/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: noticeTitle,
            content: pending.content || undefined,
            type: fileUrl ? "file" : "text",
            fileUrl: fileUrl || undefined,
            fileName: fileName || undefined,
            thumbnailUrl: fileUrl && !fileType.includes("pdf") ? fileUrl : null,
            isPinned: options.isPinned, isPublished: true, isPublic: true,
            language: "en", showOnCalendar: options.showOnCalendar,
            eventStartDate: pending.start,
            eventEndDate: pending.end,
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
      }

      if (editNotice) {
        toast({ title: "Schedule updated" });
      } else {
        const count = pending.mode === "ai" ? pending.entries.length : 1;
        toast({ title: `Schedule posted (${count} ${count === 1 ? "entry" : "entries"})` });
      }
      onSaved(); onClose(); resetForm();
    } catch {
      toast({ title: "Error saving", description: "Network error — please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const applyConflictResolutions = async () => {
    if (!pendingSave) return;
    setShowConflictDialog(false);
    await executeSave(pendingSave, conflictResolutions);
    setConflicts([]);
    setConflictResolutions({});
    setPendingSave(null);
  };

  if (!open) return null;

  const canSave = mode === "ai"
    ? (entriesFromAi && aiEntries.length > 0)
    : (fileUrl && selectedWeeks.length > 0);

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

          {/* Mode switch: Manual vs AI */}
          <div className="flex rounded-xl border border-border/40 overflow-hidden">
            <button
              type="button"
              onClick={() => { setMode("ai"); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === "ai" ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white" : "hover:bg-accent text-muted-foreground"}`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              AI Process
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${mode === "manual" ? "bg-indigo-600 text-white" : "hover:bg-accent text-muted-foreground"}`}
            >
              <Type className="h-3.5 w-3.5" />
              Manual Entry
            </button>
          </div>

          {/* ── AI MODE ── */}
          {mode === "ai" && (
            <>
              {/* Auto-process button */}
              {aiEnabled ? (
                fileUrl ? (
                  <Button
                    size="sm"
                    className="rounded-lg w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
                    onClick={autoProcessWithAi}
                    disabled={aiProcessing}
                  >
                    {aiProcessing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                    {aiProcessing ? "Processing with AI..." : "Auto-Process with AI"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">Upload a schedule image above to enable AI auto-processing.</p>
                )
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">AI processing requires a Gemini API key (set in Settings).</p>
              )}

              {/* Manual AI paste (collapsible) */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowAiPaste(!showAiPaste)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAiPaste ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Paste AI output manually
                </button>
                {showAiPaste && (
                  <div className="space-y-3 rounded-xl border border-border/40 p-3 bg-muted/10">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg w-full bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950/30"
                      onClick={async () => {
                        if (!fileUrl) {
                          navigator.clipboard.writeText(aiPromptTemplate).then(() => toast({ title: "AI prompt copied to clipboard" }));
                          return;
                        }
                        try {
                          const absoluteUrl = fileUrl.startsWith("http") ? fileUrl : `${window.location.origin}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
                          const imgRes = await fetch(absoluteUrl);
                          if (!imgRes.ok) throw new Error("Failed to fetch image");
                          let imgBlob = await imgRes.blob();
                          if (imgBlob.type !== "image/png") {
                            const bitmap = await createImageBitmap(imgBlob);
                            const canvas = document.createElement("canvas");
                            canvas.width = bitmap.width;
                            canvas.height = bitmap.height;
                            const ctx = canvas.getContext("2d");
                            if (!ctx) throw new Error("Canvas not supported");
                            ctx.drawImage(bitmap, 0, 0);
                            imgBlob = await new Promise<Blob>((resolve, reject) => {
                              canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png");
                            });
                          }
                          if (navigator.clipboard && window.ClipboardItem) {
                            const clipboardItem = new ClipboardItem({
                              "text/plain": new Blob([aiPromptTemplate], { type: "text/plain" }),
                              "image/png": imgBlob,
                            });
                            await navigator.clipboard.write([clipboardItem]);
                            toast({ title: "AI prompt + image copied to clipboard!", description: "Paste into your AI chat (Ctrl+V / Cmd+V)" });
                          } else {
                            await navigator.clipboard.writeText(aiPromptTemplate);
                            toast({ title: "AI prompt copied (image not supported on this browser)", description: "Attach the image manually in your AI chat" });
                          }
                        } catch {
                          navigator.clipboard.writeText(aiPromptTemplate).then(() => toast({ title: "AI prompt copied to clipboard", description: "Attach the image manually in your AI chat" }));
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy for AI (prompt + image)
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
            </>
          )}

          {/* Missing-week warning — a gap in the weekly schedule sequence */}
          {displayEntries.length > 0 && missingWeeks.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Missing weeks in the schedule</p>
                <p className="text-xs text-amber-600/90 dark:text-amber-400/90 mt-0.5">
                  No meeting scheduled for {missingWeeks.map(d =>
                    new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  ).join(", ")}. Check the image covers every week.
                </p>
              </div>
            </div>
          )}

          {/* AI-parsed entries — shown as colored cards with structured fields */}
          {mode === "ai" && entriesFromAi && aiEntries.length > 0 && (
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
                const entryColor = entry.color || null;
                return (
                  <div key={idx} className={`relative rounded-2xl border-2 p-3 space-y-2.5 transition-all ${isCorrectDay ? `${isMidweek ? "border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10" : "border-purple-200 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/10"}` : "border-amber-300 dark:border-amber-700/50 bg-amber-50/30 dark:bg-amber-950/10"}`}>
                    {/* Color accent strip from AI */}
                    {entryColor && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ backgroundColor: entryColor }} />
                    )}
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
                          {entryColor && (
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entryColor }} />
                              {entryColor}
                            </span>
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

                    {/* Structured fields with colors + icons */}
                    <div className="space-y-1.5">
                      {fields.map((field, fieldIdx) => {
                        const cfg = getFieldConfig(field.key, variant);
                        const Icon = cfg.icon;
                        return (
                          <div key={fieldIdx} className={`flex items-center gap-2 rounded-lg border ${cfg.border} ${cfg.bg} px-2 py-1`}>
                            <div className={`shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-white ${cfg.iconBg}`}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text} shrink-0 w-[100px]`}>
                              {cfg.label || field.key}
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

          {/* Manual text mode — only in manual mode */}
          {mode === "manual" && (manualText || fileUrl) && (
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
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Text per meeting ({meetingEntries.length}):
                    </Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setManualEditMode("list")}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${manualEditMode === "list" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" : "text-muted-foreground hover:bg-accent"}`}
                      >
                        <List className="h-3 w-3" /> List
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualEditMode("raw")}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${manualEditMode === "raw" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" : "text-muted-foreground hover:bg-accent"}`}
                      >
                        <Type className="h-3 w-3" /> Raw
                      </button>
                    </div>
                  </div>
                  {meetingEntries.map((entry, idx) => {
                    const d = new Date(entry.date + "T00:00:00");
                    const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    return (
                      <div key={idx} className={`rounded-2xl border-2 p-3 space-y-2.5 ${isMidweek ? "border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10" : "border-purple-200 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/10"}`}>
                        {/* Date header bar */}
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white ${isMidweek ? "bg-blue-500" : "bg-purple-500"}`}>
                            {isMidweek ? "MW" : "PT"}
                          </div>
                          <span className="text-sm font-semibold leading-tight">{dateLabel}</span>
                        </div>

                        {manualEditMode === "list" ? (
                          <div className="space-y-1.5">
                            {parseFields(entry.content).map((field, fieldIdx) => {
                              const cfg = getFieldConfig(field.key, variant);
                              const Icon = cfg.icon;
                              return (
                                <div key={fieldIdx} className={`flex items-center gap-2 rounded-lg border ${cfg.border} ${cfg.bg} px-2 py-1`}>
                                  <div className={`shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-white ${cfg.iconBg}`}>
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <select
                                    value={field.key}
                                    onChange={(e) => updateManualFieldKey(idx, fieldIdx, e.target.value)}
                                    className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text} shrink-0 w-[100px] bg-transparent border-none outline-none cursor-pointer`}
                                  >
                                    {(isMidweek ? MIDWEEK_FIELD_TEMPLATES : PUBLIC_TALK_FIELD_TEMPLATES).map(k => {
                                      const c = getFieldConfig(k, variant);
                                      return <option key={k} value={k}>{c.label}</option>;
                                    })}
                                    {!((isMidweek ? MIDWEEK_FIELD_TEMPLATES : PUBLIC_TALK_FIELD_TEMPLATES).includes(field.key)) && (
                                      <option value={field.key}>{field.key}</option>
                                    )}
                                  </select>
                                  <Input
                                    value={field.value}
                                    onChange={(e) => updateManualField(idx, fieldIdx, e.target.value)}
                                    placeholder="—"
                                    className="rounded-md text-xs h-7 flex-1 min-w-0 border-transparent bg-background/50 focus-visible:border-border"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-500 shrink-0"
                                    onClick={() => removeManualField(idx, fieldIdx)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                            {/* Add field dropdown */}
                            <div className="flex gap-1 flex-wrap">
                              {(isMidweek ? MIDWEEK_FIELD_TEMPLATES : PUBLIC_TALK_FIELD_TEMPLATES)
                                .filter(k => !parseFields(entry.content).some(f => f.key === k))
                                .map(k => {
                                  const c = getFieldConfig(k, variant);
                                  const Icon = c.icon;
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() => addManualField(idx, k)}
                                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border ${c.border} ${c.bg} ${c.text} hover:opacity-80 transition-opacity`}
                                    >
                                      <Icon className="h-3 w-3" />
                                      {c.label}
                                      <Plus className="h-2.5 w-2.5" />
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        ) : (
                          <Textarea
                            value={entry.content}
                            onChange={(e) => updateEntryContent(idx, e.target.value)}
                            rows={4}
                            className="rounded-lg text-xs font-mono"
                            placeholder="Text for this meeting..."
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Week selector — only in manual mode */}
          {mode === "manual" && (
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
            {editNotice ? "Save Changes" : `Upload & Post ${useAiEntries && aiEntries.length > 1 ? `(${aiEntries.length} entries)` : selectedWeeks.length > 1 ? `(${selectedWeeks.length} weeks)` : ""}`}
          </Button>
        </div>
      </div>

      {/* Conflict Resolution Dialog */}
      {showConflictDialog && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowConflictDialog(false)}>
          <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
              <h2 className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Duplicate Schedules Found ({conflicts.length})
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowConflictDialog(false)} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Schedules already exist for these dates. Choose how to handle each one:</p>
              {conflicts.map((c, i) => (
                <div key={i} className="rounded-xl border border-border/40 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isMidweek ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"}`}>
                      {isMidweek ? "MW" : "PT"}
                    </span>
                    <span className="text-sm font-medium">
                      {new Date(c.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    {c.existing?.title && (
                      <span className="text-xs text-muted-foreground truncate">— {c.existing.title}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setConflictResolutions(prev => ({ ...prev, [c.key]: "override" }))}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${conflictResolutions[c.key] === "override" ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "border-border/40 hover:bg-accent"}`}
                    >
                      Override
                    </button>
                    <button
                      onClick={() => setConflictResolutions(prev => ({ ...prev, [c.key]: "skip" }))}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${conflictResolutions[c.key] === "skip" ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" : "border-border/40 hover:bg-accent"}`}
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => setConflictResolutions(prev => ({ ...prev, [c.key]: "compare" }))}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${conflictResolutions[c.key] === "compare" ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "border-border/40 hover:bg-accent"}`}
                    >
                      Compare
                    </button>
                  </div>
                  {conflictResolutions[c.key] === "compare" && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Existing</p>
                        <div className="rounded-lg border border-border/30 bg-muted/20 p-2 max-h-32 overflow-y-auto">
                          <p className="text-xs whitespace-pre-wrap font-mono">{c.existing?.content || c.existing?.title || "(no text)"}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">New</p>
                        <div className="rounded-lg border border-border/30 bg-muted/20 p-2 max-h-32 overflow-y-auto">
                          <p className="text-xs whitespace-pre-wrap font-mono">{c.newContent || "(no text)"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border/40 shrink-0 flex items-center justify-between">
              <button
                onClick={() => {
                  const all: Record<string, "override" | "skip" | "compare"> = {};
                  conflicts.forEach(c => { all[c.key] = "override"; });
                  setConflictResolutions(all);
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Override all
              </button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setShowConflictDialog(false)}>Cancel</Button>
                <Button size="sm" className="rounded-lg bg-indigo-600 hover:bg-indigo-700" onClick={applyConflictResolutions}>
                  Apply & Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
