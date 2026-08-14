"use client";

import { useState, useCallback, useEffect } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Loader2, BookOpen, Mic, ClipboardPaste, ChevronDown, ChevronUp, Copy } from "lucide-react";
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

interface MeetingEntry {
  date: string;
  content: string;
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

  const isMidweek = variant === "midweek";
  const title = isMidweek ? "Midweek Meeting Schedule" : "Public Talk Schedule";
  const Icon = isMidweek ? BookOpen : Mic;

  // AI prompt template — different for midweek vs public talk
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

  useEffect(() => {
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
  }, [manualText, selectedWeeks, meetingDay]);

  const handleUpload = useCallback((result: { url: string; fileName: string; type: string }) => {
    setFileUrl(result.url);
    setFileName(result.fileName);
    setFileType(result.type);
    setMeetingEntries([]);
  }, []);

  const resetForm = () => {
    setFileUrl(null); setFileName(null); setFileType(""); setSelectedWeeks([]);
    setOptions({ isPinned: false, expiresAt: "", showOnCalendar: false, eventStartDate: "", eventEndDate: "", location: "", latitude: null, longitude: null });
    setMeetingEntries([]); setManualText("");
    setShowAiPaste(false); setAiPasteText("");
  };

  const updateEntryContent = (idx: number, content: string) => {
    setMeetingEntries(prev => prev.map((e, i) => i === idx ? { ...e, content } : e));
  };

  const parseAiOutput = () => {
    if (!aiPasteText.trim()) return;

    let parsedEntries: { date: string; content: string }[] = [];

    // Try JSON parsing first
    try {
      const parsed = JSON.parse(aiPasteText.trim());
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        parsedEntries = parsed.map((obj: Record<string, string>) => {
          const dateStr = obj.Date || obj.date || "";
          const roleLines = Object.entries(obj)
            .filter(([k]) => k.toLowerCase() !== "date")
            .map(([k, v]) => `${k}: ${v}`);
          return { date: dateStr, content: roleLines.join("\n") };
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
          currentDate = dateMatch[1];
          currentContent = line.includes(":") && !line.match(/^Date:/i) ? [line] : [];
        } else if (line.trim()) {
          currentContent.push(line);
        }
      }
      if (currentDate && currentContent.length > 0) {
        parsedEntries.push({ date: currentDate, content: currentContent.join("\n").trim() });
      }
    }

    if (parsedEntries.length === 0) {
      // Just use the raw text
      setManualText(aiPasteText.trim());
    } else if (parsedEntries.length === 1) {
      // Single entry — put into manualText (will be split across selected weeks)
      setManualText(parsedEntries[0].content);
    } else {
      // Multiple entries — build a combined text with date headers so the
      // existing manualText→meetingEntries splitter can pick them up
      const combined = parsedEntries.map(e => `${e.date}\n${e.content}`).join("\n\n");
      setManualText(combined);
    }

    setShowAiPaste(false);
    setAiPasteText("");
    toast({ title: `Parsed ${parsedEntries.length || 1} entr${(parsedEntries.length || 1) === 1 ? "y" : "ies"} from AI output` });
  };

  const handleSave = async () => {
    if (!fileUrl || selectedWeeks.length === 0) return;
    setSaving(true);
    const category = categories.find(c => c.name === "Meetings");
    try {
      const useOcrEntries = meetingEntries.length > 0 && meetingEntries.some(e => e.content.trim());

      // Sort selected weeks to find the full date range
      const sortedWeeks = [...selectedWeeks].sort();
      const firstMonday = new Date(sortedWeeks[0] + "T00:00:00");
      const lastMonday = new Date(sortedWeeks[sortedWeeks.length - 1] + "T00:00:00");
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastSunday.getDate() + 6);

      // Build a combined description from all meeting entries
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

      const dateRangeLabel = `${firstMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lastSunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

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
          type: "file", fileUrl, fileName,
          thumbnailUrl: fileType.includes("pdf") ? null : fileUrl,
          isPinned: options.isPinned, isPublished: true, isPublic: true,
          language: "en", showOnCalendar: options.showOnCalendar,
          eventStartDate: toYMD(firstMonday),
          eventEndDate: toYMD(lastSunday),
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

      toast({ title: "Schedule posted" });
      onSaved(); onClose(); resetForm();
    } catch {
      toast({ title: "Error saving", description: "Network error — please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

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

          {fileUrl && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Paste schedule text (optional)</Label>
              <Textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={4}
                placeholder="Paste the schedule text here. It will be split into per-meeting entries for each selected week."
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

          <WeekSelector
            selectedWeeks={selectedWeeks}
            onChange={setSelectedWeeks}
            meetingDay={meetingDay}
            label={`Which meeting(s) is this for? (${DAY_NAMES[meetingDay]} ${meetingTime})`}
          />
          <AdvancedOptions state={options} onChange={setOptions} showCalendar={true} />
        </div>
        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSave} disabled={!fileUrl || selectedWeeks.length === 0 || saving} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Upload & Post {selectedWeeks.length > 1 ? `(${selectedWeeks.length} weeks)` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
