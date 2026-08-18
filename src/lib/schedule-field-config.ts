import {
  Mic, Users, BookOpen, Hand, FileText, ScrollText, Gem,
  GraduationCap, MessageSquare, BookCopy, Eye, UserCog,
  type LucideIcon,
} from "lucide-react";

export interface ScheduleFieldConfig {
  label: string;
  icon: LucideIcon;
  /** Midweek color scheme (blue/teal/indigo family) */
  mw: { bg: string; text: string; border: string; dot: string; iconBg: string };
  /** Public talk color scheme (purple/amber/rose family) */
  pt: { bg: string; text: string; border: string; dot: string; iconBg: string };
}

// Shared field definitions — each field has an icon and distinct color for
// both midweek (blue family) and public talk (purple family) variants.
export const SCHEDULE_FIELDS: Record<string, ScheduleFieldConfig> = {
  // ── Public Talk fields ──────────────────────────────────
  Speaker: {
    label: "Speaker",
    icon: Mic,
    mw: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800/40", dot: "bg-blue-500", iconBg: "bg-blue-500" },
    pt: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800/40", dot: "bg-purple-500", iconBg: "bg-purple-500" },
  },
  Congregation: {
    label: "Congregation",
    icon: Users,
    mw: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800/40", dot: "bg-cyan-500", iconBg: "bg-cyan-500" },
    pt: { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", text: "text-fuchsia-700 dark:text-fuchsia-300", border: "border-fuchsia-200 dark:border-fuchsia-800/40", dot: "bg-fuchsia-500", iconBg: "bg-fuchsia-500" },
  },
  TalkTheme: {
    label: "Talk Theme",
    icon: BookOpen,
    mw: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800/40", dot: "bg-indigo-500", iconBg: "bg-indigo-500" },
    pt: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800/40", dot: "bg-violet-500", iconBg: "bg-violet-500" },
  },
  Chairman: {
    label: "Chairman",
    icon: UserCog,
    mw: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-300", border: "border-sky-200 dark:border-sky-800/40", dot: "bg-sky-500", iconBg: "bg-sky-500" },
    pt: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/40", dot: "bg-amber-500", iconBg: "bg-amber-500" },
  },
  Prayer: {
    label: "Prayer",
    icon: Hand,
    mw: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800/40", dot: "bg-green-500", iconBg: "bg-green-500" },
    pt: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800/40", dot: "bg-emerald-500", iconBg: "bg-emerald-500" },
  },
  WTStudyReader: {
    label: "WT Study Reader",
    icon: ScrollText,
    mw: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/40", dot: "bg-amber-500", iconBg: "bg-amber-500" },
    pt: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800/40", dot: "bg-orange-500", iconBg: "bg-orange-500" },
  },

  // ── Midweek Meeting fields ──────────────────────────────
  BibleReading: {
    label: "Bible Reading",
    icon: BookCopy,
    mw: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800/40", dot: "bg-blue-500", iconBg: "bg-blue-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
  TreasuresTalk: {
    label: "Treasures Talk",
    icon: FileText,
    mw: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800/40", dot: "bg-indigo-500", iconBg: "bg-indigo-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
  TreasuresGem: {
    label: "Treasures Gem",
    icon: Gem,
    mw: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800/40", dot: "bg-violet-500", iconBg: "bg-violet-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
  ApplyYourself1: {
    label: "Apply Yourself #1",
    icon: GraduationCap,
    mw: { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800/40", dot: "bg-teal-500", iconBg: "bg-teal-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
  ApplyYourself2: {
    label: "Apply Yourself #2",
    icon: GraduationCap,
    mw: { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800/40", dot: "bg-teal-500", iconBg: "bg-teal-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
  ApplyYourself3: {
    label: "Apply Yourself #3",
    icon: GraduationCap,
    mw: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800/40", dot: "bg-cyan-500", iconBg: "bg-cyan-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
  LivingTalk: {
    label: "Living Talk",
    icon: MessageSquare,
    mw: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800/40", dot: "bg-rose-500", iconBg: "bg-rose-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
  CongregationBibleStudy: {
    label: "Congregation Bible Study",
    icon: BookOpen,
    mw: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/40", dot: "bg-amber-500", iconBg: "bg-amber-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
  Reader: {
    label: "Reader",
    icon: Eye,
    mw: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800/40", dot: "bg-green-500", iconBg: "bg-green-500" },
    pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-500", iconBg: "bg-slate-500" },
  },
};

// Default field config for unknown keys
const DEFAULT_CONFIG: ScheduleFieldConfig = {
  label: "",
  icon: FileText,
  mw: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-400", iconBg: "bg-slate-400" },
  pt: { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-800/40", dot: "bg-slate-400", iconBg: "bg-slate-400" },
};

export type ScheduleVariant = "midweek" | "public-talk";

export function getFieldConfig(key: string, variant: ScheduleVariant) {
  const cfg = SCHEDULE_FIELDS[key] || { ...DEFAULT_CONFIG, label: key };
  const colors = variant === "public-talk" ? cfg.pt : cfg.mw;
  return { ...cfg, ...colors };
}

// Parse content string "Key: #3 Value\nKey: Value" into structured fields.
// A leading "#N" in a value becomes the field's part number (num).
export function parseScheduleFields(content: string | null): { key: string; value: string; num?: number }[] {
  if (!content) return [];
  const lines = content.split("\n");
  const result: { key: string; value: string; num?: number }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip header lines like "Public talk schedule for ..." or "Midweek meeting schedule for ..."
    if (/^(Midweek meeting|Public talk)\s+schedule for/i.test(trimmed)) continue;
    // Skip day-of-week header lines like "Sun Aug 23", "Sun, Aug 23", "Sunday, August 23"
    if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w*,?\s+\w+\s+\d+/i.test(trimmed)) continue;
    const idx = trimmed.indexOf(":");
    if (idx > 0) {
      let key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      // Leading "#N" is the part number shown on the schedule image
      const numMatch = value.match(/^#(\d+)\s*/);
      let num: number | undefined;
      if (numMatch) {
        num = parseInt(numMatch[1], 10);
        value = value.slice(numMatch[0].length);
      }
      // The key itself may carry the number (e.g. "1 BibleReading: John")
      const keyNum = key.match(/^#?(\d+)\s+(.+)$/);
      if (!num && keyNum) {
        num = parseInt(keyNum[1], 10);
        key = keyNum[2];
      }
      result.push({ key, value, num });
    } else {
      result.push({ key: trimmed, value: "" });
    }
  }
  return result;
}

// Convert structured fields back to content string, preserving part numbers
export function fieldsToContent(fields: { key: string; value: string; num?: number }[]): string {
  return fields
    .filter(f => f.key.trim() || f.value.trim())
    .map(f => {
      const prefix = f.num ? `#${f.num} ` : "";
      return f.value.trim() ? `${prefix}${f.key.trim()}: ${f.value.trim()}` : `${prefix}${f.key.trim()}`;
    })
    .join("\n");
}

// Sort fields by part number when present, keeping original order otherwise
export function sortFieldsByNum(fields: { key: string; value: string; num?: number }[]): { key: string; value: string; num?: number }[] {
  return [...fields].sort((a, b) => {
    if (a.num !== undefined && b.num !== undefined) return a.num - b.num;
    if (a.num !== undefined) return -1;
    if (b.num !== undefined) return 1;
    return 0;
  });
}

// Check if content looks like a schedule (has known schedule field names)
const KNOWN_FIELDS = Object.keys(SCHEDULE_FIELDS);
export function isScheduleContent(content: string): boolean {
  return KNOWN_FIELDS.some(f => content.includes(f + ":"));
}

// Default field templates for each variant (used when adding new fields in list mode)
export const MIDWEEK_FIELD_TEMPLATES = [
  "BibleReading", "TreasuresTalk", "TreasuresGem",
  "ApplyYourself1", "ApplyYourself2", "ApplyYourself3",
  "LivingTalk", "CongregationBibleStudy", "Reader", "Prayer", "Chairman",
];

export const PUBLIC_TALK_FIELD_TEMPLATES = [
  "Speaker", "Congregation", "TalkTheme",
  "Chairman", "Prayer", "WTStudyReader",
];
