"use client";

import { useState, useCallback, useEffect } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";
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
import {
  X, Loader2, UserCog, Type, Image as ImageIcon, Plus, Trash2,
  ChevronDown, ChevronUp, Save, BookTemplate, Copy, ClipboardPaste,
  AlertTriangle, Code, List,
} from "lucide-react";
import { FileUploadZone } from "@/components/shared/file-upload-zone";
import { WeekSelector } from "@/components/shared/week-selector";
import { useToast } from "@/hooks/use-toast";

interface WeeklyRolesModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface WeekRoles {
  weekDate: string;
  meetingType: "midweek" | "weekend" | "both";
  roles: string;
}

interface RoleTemplate {
  id: string;
  name: string;
  meetingType: string;
  template: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseDateFromText(text: string): string | null {
  // Try YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // Try "Month Day" (e.g. "January 15" or "Jan 15")
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
  // Try MM/DD/YYYY or MM/DD/YY
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

const ROLES_PLACEHOLDER = "Audio: ___\nVideo: ___\nMicrophones: ___\nAttendant: ___\nSecurity: ___\n...";

interface RoleLine { name: string; assignee: string }

function parseRoleLines(text: string): RoleLine[] {
  if (!text.trim()) return [];
  const lines = text.split("\n");
  const result: RoleLine[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[:\-—]|\t/).map(s => s.trim());
    if (parts.length >= 2) {
      result.push({ name: parts[0], assignee: parts.slice(1).join(" ") });
    } else {
      result.push({ name: trimmed, assignee: "" });
    }
  }
  return result;
}

function roleLinesToText(lines: RoleLine[]): string {
  return lines
    .filter(l => l.name.trim() || l.assignee.trim())
    .map(l => l.assignee.trim() ? `${l.name.trim()}: ${l.assignee.trim()}` : l.name.trim())
    .join("\n");
}

function rolesToJson(week: WeekRoles): string {
  const parsed = parseRoleLines(week.roles);
  const obj: Record<string, string> = {};
  obj["Date"] = week.weekDate || "";
  for (const r of parsed) {
    if (r.name.trim()) obj[r.name.trim()] = r.assignee.trim() || "___";
  }
  return JSON.stringify(obj, null, 2);
}

export function WeeklyRolesModal({ open, onClose, onSaved }: WeeklyRolesModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"type" | "upload">("type");
  const [weeks, setWeeks] = useState<WeekRoles[]>([{ weekDate: "", meetingType: "midweek", roles: "" }]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [selectedMeetingType, setSelectedMeetingType] = useState<"midweek" | "weekend" | "both">("midweek");
  const [saving, setSaving] = useState(false);
  const [midweekDay, setMidweekDay] = useState(2);
  const [weekendDay, setWeekendDay] = useState(6);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showAiPaste, setShowAiPaste] = useState(false);
  const [aiPasteText, setAiPasteText] = useState("");
  const [aiTemplate, setAiTemplate] = useState("");
  const [existingRoles, setExistingRoles] = useState<{ id: string; weekDate: string; meetingType: string; ocrText: string | null }[]>([]);
  const [conflicts, setConflicts] = useState<{ weekDate: string; meetingType: string; existing: { id: string; ocrText: string | null } | null; newRoles: string }[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, "override" | "skip" | "compare">>({});
  const [pendingSaveData, setPendingSaveData] = useState<{ weekDate: string; meetingType: string; roles: string; fileUrl?: string | null; fileName?: string | null }[] | null>(null);
  const [expandedJson, setExpandedJson] = useState<Set<number>>(new Set());
  const [roleEditMode, setRoleEditMode] = useState<Record<number, "list" | "raw">>({});

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/role-templates");
      if (res.ok) setTemplates(await res.json());
    } catch {}
  }, []);

  const fetchExistingRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        setExistingRoles(data.map((r: { id: string; weekDate: string | null; meetingType: string; ocrText: string | null }) => ({
          id: r.id,
          weekDate: r.weekDate || "",
          meetingType: r.meetingType,
          ocrText: r.ocrText,
        })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      fetch("/api/settings").then(res => res.ok ? res.json() : {}).then((data: Record<string, unknown>) => {
        if (data.midweekDay !== undefined) setMidweekDay(Number(data.midweekDay));
        if (data.weekendDay !== undefined) setWeekendDay(Number(data.weekendDay));
        if (data.roleEntries !== undefined && Array.isArray(data.roleEntries)) {
          const entries = data.roleEntries as { name: string; count: number }[];
          const entryObj: Record<string, string> = { Date: "{YYYY-MM-DD}" };
          for (const r of entries) {
            if (r.count > 1) {
              const placeholders = Array.from({ length: r.count }, (_, i) => i === 0 ? "{Name}" : `{Name${i + 1}}`);
              entryObj[r.name] = placeholders.join(" & ");
            } else {
              entryObj[r.name] = "{Name}";
            }
          }
          const templateJson = JSON.stringify([entryObj], null, 2);
          const prompt = `Convert the following image into this exact JSON format:\n\n${templateJson}\n\nReturn ONLY the JSON array, one object per date. If there are multiple dates in the image, include multiple objects in the array.`;
          setAiTemplate(prompt);
        }
        if (data.customAiPrompt) {
          setAiTemplate(String(data.customAiPrompt));
        }
      }).catch(() => {});
      fetchTemplates();
      fetchExistingRoles();
    }
  }, [open, fetchTemplates, fetchExistingRoles]);

  useScrollLock(open);

  const resetForm = () => {
    setMode("type");
    setWeeks([{ weekDate: "", meetingType: "midweek", roles: "" }]);
    setFileUrl(null); setFileName(null); setSelectedWeeks([]);
    setSelectedMeetingType("midweek");
    setTemplateName("");
    setShowAiPaste(false); setAiPasteText("");
  };

  const addWeek = () => {
    setWeeks(prev => [...prev, { weekDate: "", meetingType: "midweek", roles: "" }]);
  };

  const removeWeek = (idx: number) => {
    setWeeks(prev => prev.filter((_, i) => i !== idx));
  };

  const updateWeek = (idx: number, field: keyof WeekRoles, value: string) => {
    setWeeks(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w));
  };

  const updateRoleLine = (weekIdx: number, lineIdx: number, field: keyof RoleLine, value: string) => {
    setWeeks(prev => prev.map((w, i) => {
      if (i !== weekIdx) return w;
      const lines = parseRoleLines(w.roles);
      if (lineIdx < 0 || lineIdx >= lines.length) return w;
      lines[lineIdx] = { ...lines[lineIdx], [field]: value };
      return { ...w, roles: roleLinesToText(lines) };
    }));
  };

  const addRoleLine = (weekIdx: number) => {
    setWeeks(prev => prev.map((w, i) => {
      if (i !== weekIdx) return w;
      const lines = parseRoleLines(w.roles);
      lines.push({ name: "", assignee: "" });
      return { ...w, roles: roleLinesToText(lines) };
    }));
  };

  const removeRoleLine = (weekIdx: number, lineIdx: number) => {
    setWeeks(prev => prev.map((w, i) => {
      if (i !== weekIdx) return w;
      const lines = parseRoleLines(w.roles);
      lines.splice(lineIdx, 1);
      return { ...w, roles: roleLinesToText(lines) };
    }));
  };

  const toggleJsonExpand = (idx: number) => {
    setExpandedJson(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleUpload = useCallback((result: { url: string; fileName: string; type: string }) => {
    setFileUrl(result.url); setFileName(result.fileName);
  }, []);

  const detectMeetingType = (dateStr: string): "midweek" | "weekend" => {
    if (!dateStr) return "midweek";
    const date = new Date(dateStr + "T00:00:00");
    if (isNaN(date.getTime())) return "midweek";
    const dayOfWeek = date.getDay();
    // Distance to midweek day vs weekend day
    const midweekDist = Math.min(Math.abs(dayOfWeek - midweekDay), 7 - Math.abs(dayOfWeek - midweekDay));
    const weekendDist = Math.min(Math.abs(dayOfWeek - weekendDay), 7 - Math.abs(dayOfWeek - weekendDay));
    return midweekDist <= weekendDist ? "midweek" : "weekend";
  };

  const parseAiOutput = () => {
    if (!aiPasteText.trim()) return;

    // Try JSON parsing first
    try {
      const parsed = JSON.parse(aiPasteText.trim());
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        const newWeeks = parsed.map((obj: Record<string, string>) => {
          const dateStr = obj.Date || obj.date || "";
          const parsedDate = parseDateFromText(dateStr) || dateStr;
          const mt = detectMeetingType(parsedDate);
          const roleLines = Object.entries(obj)
            .filter(([k]) => k.toLowerCase() !== "date")
            .map(([k, v]) => `${k}: ${v}`);
          return {
            weekDate: parsedDate,
            meetingType: mt,
            roles: roleLines.join("\n"),
          };
        });
        // Sort by date ascending
        newWeeks.sort((a, b) => a.weekDate.localeCompare(b.weekDate));
        setWeeks(newWeeks);
        setShowAiPaste(false);
        setAiPasteText("");
        setMode("type");
        toast({ title: `Parsed ${newWeeks.length} entr${newWeeks.length === 1 ? "y" : "ies"} from AI JSON output` });
        return;
      }
    } catch {
      // Not valid JSON, fall through to text parsing
    }

    // Fallback: text-based parsing
    const lines = aiPasteText.split("\n");
    const entries: { date: string; roles: string }[] = [];
    let currentDate: string | null = null;
    let currentRoles: string[] = [];

    for (const line of lines) {
      const dateMatch = line.match(/^(?:Date:\s*)?(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i);
      if (dateMatch) {
        if (currentDate && currentRoles.length > 0) {
          entries.push({ date: currentDate, roles: currentRoles.join("\n").trim() });
        }
        const rawDate = dateMatch[1];
        const parsed = parseDateFromText(rawDate);
        currentDate = parsed || rawDate;
        currentRoles = line.includes(":") && !line.match(/^Date:/i) ? [line] : [];
      } else if (line.trim()) {
        currentRoles.push(line);
      }
    }
    if (currentDate && currentRoles.length > 0) {
      entries.push({ date: currentDate, roles: currentRoles.join("\n").trim() });
    }

    if (entries.length === 0) {
      setWeeks([{ weekDate: "", meetingType: "midweek", roles: aiPasteText.trim() }]);
    } else {
      const mapped = entries.map(e => ({ weekDate: e.date, meetingType: detectMeetingType(e.date) as "midweek" | "weekend" | "both", roles: e.roles }));
      mapped.sort((a, b) => a.weekDate.localeCompare(b.weekDate));
      setWeeks(mapped);
    }
    setShowAiPaste(false);
    setAiPasteText("");
    setMode("type");
    toast({ title: `Parsed ${entries.length || 1} entr${(entries.length || 1) === 1 ? "y" : "ies"} from AI output` });
  };

  const applyTemplate = (template: RoleTemplate) => {
    setWeeks(prev => prev.map((w, i) => i === 0 ? { ...w, roles: template.template, meetingType: template.meetingType as "midweek" | "weekend" | "both" } : w));
    setShowTemplates(false);
    toast({ title: `Applied template: ${template.name}` });
  };

  const saveTemplate = async () => {
    if (!templateName || !weeks[0]?.roles) return;
    try {
      const res = await fetch("/api/role-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          meetingType: weeks[0].meetingType,
          template: weeks[0].roles,
        }),
      });
      if (res.ok) {
        toast({ title: "Template saved" });
        setTemplateName("");
        fetchTemplates();
      }
    } catch {
      toast({ title: "Error saving template", variant: "destructive" });
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/role-templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Template deleted" });
        fetchTemplates();
      }
    } catch {
      toast({ title: "Error deleting template", variant: "destructive" });
    }
  };

  const meetingTypesFor = (type: "midweek" | "weekend" | "both"): ("midweek" | "weekend")[] =>
    type === "both" ? ["midweek", "weekend"] : [type];

  const handleSave = async () => {
    // Build list of entries to save
    const entries: { weekDate: string; meetingType: string; roles: string; fileUrl?: string | null; fileName?: string | null }[] = [];
    if (mode === "type") {
      for (const week of weeks) {
        if (!week.weekDate || !week.roles) continue;
        for (const mt of meetingTypesFor(week.meetingType)) {
          entries.push({ weekDate: week.weekDate, meetingType: mt, roles: week.roles });
        }
      }
    } else {
      if (!fileUrl || selectedWeeks.length === 0) return;
      for (const weekDate of selectedWeeks) {
        for (const mt of meetingTypesFor(selectedMeetingType)) {
          entries.push({ weekDate, meetingType: mt, roles: "", fileUrl, fileName });
        }
      }
    }

    if (entries.length === 0) return;

    // Check for conflicts
    const foundConflicts: { weekDate: string; meetingType: string; existing: { id: string; ocrText: string | null } | null; newRoles: string }[] = [];
    for (const entry of entries) {
      const existing = existingRoles.find(r => r.weekDate === entry.weekDate && r.meetingType === entry.meetingType);
      if (existing) {
        foundConflicts.push({
          weekDate: entry.weekDate,
          meetingType: entry.meetingType,
          existing: { id: existing.id, ocrText: existing.ocrText },
          newRoles: entry.roles,
        });
      }
    }

    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts);
      setConflictResolutions({});
      setPendingSaveData(entries);
      setShowConflictDialog(true);
      return;
    }

    // No conflicts — save directly
    await executeSave(entries);
  };

  const executeSave = async (entries: { weekDate: string; meetingType: string; roles: string; fileUrl?: string | null; fileName?: string | null }[], resolutions?: Record<string, "override" | "skip" | "compare">) => {
    setSaving(true);
    try {
      for (const entry of entries) {
        const key = `${entry.weekDate}_${entry.meetingType}`;
        const resolution = resolutions?.[key];

        if (resolution === "skip") continue;

        const meetingLabel = entry.meetingType === "midweek" ? "MW" : "WE";
        const existing = existingRoles.find(r => r.weekDate === entry.weekDate && r.meetingType === entry.meetingType);

        if (resolution === "override" && existing) {
          // Delete existing then create new
          await fetch(`/api/roles/${existing.id}`, { method: "DELETE" });
        }

        await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Weekly Roles — ${meetingLabel} — Week of ${entry.weekDate}`,
            meetingType: entry.meetingType,
            weekDate: entry.weekDate,
            ocrText: entry.roles || undefined,
            fileUrl: entry.fileUrl || undefined,
            fileName: entry.fileName || undefined,
            ocrStatus: "none",
            isPublished: true,
            showOnNoticeboard: true,
          }),
        });
      }
      toast({ title: "Roles saved" });
      onSaved(); onClose(); resetForm();
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const applyConflictResolutions = async () => {
    if (!pendingSaveData) return;
    setShowConflictDialog(false);
    await executeSave(pendingSaveData, conflictResolutions);
    setConflicts([]);
    setConflictResolutions({});
    setPendingSaveData(null);
  };

  if (!open) return null;

  const meetingDayForType = (type: "midweek" | "weekend" | "both") => type === "midweek" ? midweekDay : type === "weekend" ? weekendDay : midweekDay;

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white bg-teal-500">
              <UserCog className="h-5 w-5" />
            </div>
            <h2 className="text-base font-bold">Weekly Roles</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left sidebar — mode toggle, templates, AI prompt */}
          <div className="lg:w-[340px] lg:shrink-0 lg:border-r border-border/40 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("type")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === "type" ? "border-teal-300 bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300" : "border-border/40 hover:bg-accent"}`}
            >
              <Type className="h-4 w-4 inline mr-1" /> Type / Paste
            </button>
            <button
              onClick={() => setMode("upload")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === "upload" ? "border-teal-300 bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300" : "border-border/40 hover:bg-accent"}`}
            >
              <ImageIcon className="h-4 w-4 inline mr-1" /> Upload Image
            </button>
          </div>

          {/* Role Templates - only in type mode */}
          {mode === "type" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showTemplates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <BookTemplate className="h-3.5 w-3.5" />
                Role Templates
              </button>
              {showTemplates && (
                <div className="space-y-3 rounded-xl border border-border/40 p-3 bg-muted/10">
                  {templates.length > 0 ? (
                    <div className="space-y-1.5">
                      {templates.map(tpl => (
                        <div key={tpl.id} className="flex items-center gap-2 rounded-lg border border-border/40 p-2 bg-background">
                          <button
                            onClick={() => applyTemplate(tpl)}
                            className="flex-1 text-left text-sm font-medium hover:text-teal-600"
                          >
                            {tpl.name}
                            <span className="text-xs text-muted-foreground ml-2">({tpl.meetingType === "midweek" ? "MW" : "WE"})</span>
                          </button>
                          <button
                            onClick={() => deleteTemplate(tpl.id)}
                            className="text-muted-foreground hover:text-red-500 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No saved templates yet.</p>
                  )}
                  {/* Save current as template */}
                  <div className="flex gap-2 pt-1 border-t border-border/40">
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Template name..."
                      className="rounded-lg text-sm flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveTemplate}
                      disabled={!templateName || !weeks[0]?.roles}
                      className="rounded-lg shrink-0"
                    >
                      <Save className="h-3.5 w-3.5 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "type" ? (
            <div className="space-y-3">
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
                          {aiTemplate || `Convert the following image into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "Audio": "{Name}",\n    "Video": "{Name}",\n    "Microphone": "{Name} & {Name2}",\n    "Security": "{Name}",\n    "Attendant": "{Name}"\n  }\n]\n\nReturn ONLY the JSON array, one object per date. If there are multiple dates in the image, include multiple objects in the array.`}
                        </pre>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg w-full"
                      onClick={() => {
                        const text = aiTemplate || `Convert the following image into this exact JSON format:\n\n[\n  {\n    "Date": "{YYYY-MM-DD}",\n    "Audio": "{Name}",\n    "Video": "{Name}",\n    "Microphone": "{Name} & {Name2}",\n    "Security": "{Name}",\n    "Attendant": "{Name}"\n  }\n]\n\nReturn ONLY the JSON array, one object per date. If there are multiple dates in the image, include multiple objects in the array.`;
                        navigator.clipboard.writeText(text).then(() => toast({ title: "AI prompt copied to clipboard" }));
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
                        placeholder="Paste the AI model's JSON output here. It will be split by date into separate entries."
                        className="rounded-lg text-sm font-mono"
                      />
                      <Button
                        size="sm"
                        className="rounded-lg w-full bg-teal-600 hover:bg-teal-700"
                        onClick={parseAiOutput}
                        disabled={!aiPasteText.trim()}
                      >
                        <ClipboardPaste className="h-3.5 w-3.5 mr-1" /> Parse & Fill Entries
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <FileUploadZone
                onUpload={handleUpload}
                onClear={() => { setFileUrl(null); setFileName(null); }}
                fileUrl={fileUrl} fileName={fileName}
                accept="image/*"
                folder="roles"
              />

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Meeting type
                </Label>
                <div className="flex rounded-lg border border-border/40 overflow-hidden w-fit">
                  <button
                    type="button"
                    onClick={() => setSelectedMeetingType("midweek")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${selectedMeetingType === "midweek" ? "bg-teal-500 text-white" : "hover:bg-accent"}`}
                  >
                    MW ({DAY_NAMES[midweekDay]})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMeetingType("weekend")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${selectedMeetingType === "weekend" ? "bg-teal-500 text-white" : "hover:bg-accent"}`}
                  >
                    WE ({DAY_NAMES[weekendDay]})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMeetingType("both")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${selectedMeetingType === "both" ? "bg-teal-500 text-white" : "hover:bg-accent"}`}
                  >
                    Both
                  </button>
                </div>
              </div>
              <WeekSelector
                selectedWeeks={selectedWeeks}
                onChange={setSelectedWeeks}
                meetingDay={meetingDayForType(selectedMeetingType)}
                label={selectedMeetingType === "both" ? `Which meeting(s)? (MW: ${DAY_NAMES[midweekDay]} & WE: ${DAY_NAMES[weekendDay]})` : `Which meeting(s)? (${DAY_NAMES[meetingDayForType(selectedMeetingType)]})`}
              />
            </div>
          )}
          </div>

          {/* Right content — scrollable week entries */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {mode === "type" && (
              <>
              {weeks.map((week, idx) => {
                const isPast = week.weekDate && week.weekDate < new Date().toISOString().split("T")[0];
                const isCurrent = week.weekDate === new Date().toISOString().split("T")[0];
                const dateLabel = week.weekDate
                  ? new Date(week.weekDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                  : "No date";
                return (
                <div key={idx} className={`rounded-2xl border p-4 space-y-3 transition-all ${
                  isPast ? "border-border/20 bg-muted/5 opacity-60" :
                  isCurrent ? "border-teal-400 bg-teal-50/50 dark:bg-teal-950/20 shadow-sm" :
                  "border-border/40 bg-card"
                }`}>
                  {/* Date header bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        week.meetingType === "midweek" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" :
                        week.meetingType === "weekend" ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" :
                        "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}>
                        {week.meetingType === "midweek" ? "MW" : week.meetingType === "weekend" ? "WE" : "B"}
                      </div>
                      {week.weekDate ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold leading-tight">{dateLabel}</span>
                          {!isPast && !isCurrent && (
                            <span className="text-[10px] text-muted-foreground">Upcoming</span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] text-teal-600 font-medium">Today</span>
                          )}
                          {isPast && (
                            <span className="text-[10px] text-muted-foreground">Past</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No date set</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex rounded-lg border border-border/40 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateWeek(idx, "meetingType", "midweek")}
                          className={`px-2 py-1 text-[10px] font-bold transition-colors ${week.meetingType === "midweek" ? "bg-blue-500 text-white" : "hover:bg-accent"}`}
                        >MW</button>
                        <button
                          type="button"
                          onClick={() => updateWeek(idx, "meetingType", "weekend")}
                          className={`px-2 py-1 text-[10px] font-bold transition-colors ${week.meetingType === "weekend" ? "bg-purple-500 text-white" : "hover:bg-accent"}`}
                        >WE</button>
                        <button
                          type="button"
                          onClick={() => updateWeek(idx, "meetingType", "both")}
                          className={`px-2 py-1 text-[10px] font-bold transition-colors ${week.meetingType === "both" ? "bg-amber-500 text-white" : "hover:bg-accent"}`}
                        >Both</button>
                      </div>
                      {weeks.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeWeek(idx)} className="h-7 w-7 rounded-lg shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Date input */}
                  <Input
                    type="date"
                    value={week.weekDate}
                    onChange={(e) => updateWeek(idx, "weekDate", e.target.value)}
                    className="rounded-lg text-sm"
                  />
                  {/* Roles editor — list/raw toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</Label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRoleEditMode(prev => ({ ...prev, [idx]: "list" }))}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${(roleEditMode[idx] ?? "list") === "list" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" : "text-muted-foreground hover:bg-accent"}`}
                        >
                          <List className="h-3 w-3" /> List
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoleEditMode(prev => ({ ...prev, [idx]: "raw" }))}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${roleEditMode[idx] === "raw" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" : "text-muted-foreground hover:bg-accent"}`}
                        >
                          <Type className="h-3 w-3" /> Raw
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleJsonExpand(idx)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${expandedJson.has(idx) ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" : "text-muted-foreground hover:bg-accent"}`}
                        >
                          <Code className="h-3 w-3" /> JSON
                        </button>
                      </div>
                    </div>

                    {/* List mode: individual role inputs */}
                    {(roleEditMode[idx] ?? "list") === "list" ? (
                      <div className="space-y-1.5">
                        {parseRoleLines(week.roles).map((line, lineIdx) => (
                          <div key={lineIdx} className="flex items-center gap-1.5">
                            <Input
                              value={line.name}
                              onChange={(e) => updateRoleLine(idx, lineIdx, "name", e.target.value)}
                              placeholder="Role name"
                              className="rounded-lg text-xs h-8 flex-shrink-0 w-[110px]"
                            />
                            <span className="text-muted-foreground text-xs shrink-0">:</span>
                            <Input
                              value={line.assignee}
                              onChange={(e) => updateRoleLine(idx, lineIdx, "assignee", e.target.value)}
                              placeholder="Assignee name(s)"
                              className="rounded-lg text-xs h-8 flex-1 min-w-0"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRoleLine(idx, lineIdx)}
                              className="h-7 w-7 rounded-lg shrink-0 text-muted-foreground hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addRoleLine(idx)}
                          className="rounded-lg w-full text-xs h-7"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add role
                        </Button>
                      </div>
                    ) : (
                      /* Raw mode: single textarea */
                      <Textarea
                        value={week.roles}
                        onChange={(e) => updateWeek(idx, "roles", e.target.value)}
                        rows={5}
                        placeholder={ROLES_PLACEHOLDER}
                        className="rounded-lg text-sm font-mono"
                      />
                    )}

                    {/* Expandable JSON section */}
                    {expandedJson.has(idx) && (
                      <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/30 bg-muted/30">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">JSON Preview</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] rounded"
                            onClick={() => {
                              navigator.clipboard.writeText(rolesToJson(week)).then(() => toast({ title: "JSON copied" }));
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </Button>
                        </div>
                        <pre className="text-[11px] font-mono whitespace-pre-wrap p-2.5 overflow-x-auto max-h-48 overflow-y-auto">
                          {rolesToJson(week)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={addWeek} className="rounded-lg w-full">
                <Plus className="h-4 w-4 mr-1" /> Add another entry
              </Button>
              </>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border/40 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || (mode === "type" ? !weeks.some(w => w.weekDate && w.roles) : !fileUrl || selectedWeeks.length === 0)}
            className="bg-indigo-600 hover:bg-indigo-700 rounded-xl"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save Roles
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
                Duplicate Entries Found ({conflicts.length})
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowConflictDialog(false)} className="rounded-lg h-10 w-10 sm:h-8 sm:w-8"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Some entries already exist for these dates. Choose how to handle each one:</p>
              {conflicts.map((c, i) => {
                const key = `${c.weekDate}_${c.meetingType}`;
                return (
                  <div key={i} className="rounded-xl border border-border/40 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${c.meetingType === "midweek" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"}`}>
                        {c.meetingType === "midweek" ? "MW" : "WE"}
                      </span>
                      <span className="text-sm font-medium">
                        {new Date(c.weekDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setConflictResolutions(prev => ({ ...prev, [key]: "override" }))}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${conflictResolutions[key] === "override" ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "border-border/40 hover:bg-accent"}`}
                      >
                        Override
                      </button>
                      <button
                        onClick={() => setConflictResolutions(prev => ({ ...prev, [key]: "skip" }))}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${conflictResolutions[key] === "skip" ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" : "border-border/40 hover:bg-accent"}`}
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => setConflictResolutions(prev => ({ ...prev, [key]: "compare" }))}
                        className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${conflictResolutions[key] === "compare" ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "border-border/40 hover:bg-accent"}`}
                      >
                        Compare
                      </button>
                    </div>
                    {conflictResolutions[key] === "compare" && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Existing</p>
                          <div className="rounded-lg border border-border/30 bg-muted/20 p-2 max-h-32 overflow-y-auto">
                            <p className="text-xs whitespace-pre-wrap font-mono">{c.existing?.ocrText || "(no text)"}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">New</p>
                          <div className="rounded-lg border border-border/30 bg-muted/20 p-2 max-h-32 overflow-y-auto">
                            <p className="text-xs whitespace-pre-wrap font-mono">{c.newRoles || "(no text)"}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t border-border/40 shrink-0 flex items-center justify-between">
              <button
                onClick={() => {
                  const all: Record<string, "override" | "skip" | "compare"> = {};
                  conflicts.forEach(c => { all[`${c.weekDate}_${c.meetingType}`] = "override"; });
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
