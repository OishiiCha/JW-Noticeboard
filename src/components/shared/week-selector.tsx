"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateRangePicker } from "./date-range-picker";

interface WeekSelectorProps {
  selectedWeeks: string[]; // YYYY-MM-DD (Monday dates)
  onChange: (weeks: string[]) => void;
  meetingDay?: number; // 0=Sun, 1=Mon, etc. Used to calculate meeting date label
  maxWeeks?: number;
  label?: string; // Override the section label
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} – ${sunday.toLocaleDateString("en-US", opts)}`;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function WeekSelector({
  selectedWeeks,
  onChange,
  meetingDay = 2,
  maxWeeks = 8,
  label = "Which week(s) is this for?",
}: WeekSelectorProps) {
  const [mode, setMode] = useState<"weeks" | "month" | "range">("weeks");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const weeks = useMemo(() => {
    const today = new Date();
    const monday = getMonday(today);
    const result: { date: string; label: string }[] = [];
    for (let i = 0; i < maxWeeks; i++) {
      const weekMonday = new Date(monday);
      weekMonday.setDate(weekMonday.getDate() + i * 7);
      const meetingDate = new Date(weekMonday);
      meetingDate.setDate(weekMonday.getDate() + meetingDay);
      const meetingLabel = `${DAY_NAMES[meetingDay]} ${meetingDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      result.push({
        date: toYMD(weekMonday),
        label: meetingLabel,
      });
    }
    return result;
  }, [maxWeeks, meetingDay]);

  // Get all weeks (Mondays) in a given month
  const monthWeeks = useMemo(() => {
    const result: { date: string; label: string }[] = [];
    const firstOfMonth = new Date(selectedMonth.year, selectedMonth.month, 1);
    const firstMonday = getMonday(firstOfMonth);
    const cur = new Date(firstMonday);
    // Iterate through all Mondays that overlap with this month
    while (cur.getMonth() === selectedMonth.month || cur.getMonth() === (selectedMonth.month - 1 + 12) % 12) {
      const weekSunday = new Date(cur);
      weekSunday.setDate(weekSunday.getDate() + 6);
      // Include week if any day falls in the selected month
      if (cur.getMonth() === selectedMonth.month || weekSunday.getMonth() === selectedMonth.month) {
        const meetingDate = new Date(cur);
        meetingDate.setDate(cur.getDate() + meetingDay);
        const meetingLabel = `${DAY_NAMES[meetingDay]} ${meetingDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        result.push({ date: toYMD(cur), label: meetingLabel });
      }
      cur.setDate(cur.getDate() + 7);
      // Safety: stop if we've gone past the month
      if (cur.getMonth() !== selectedMonth.month && cur > new Date(selectedMonth.year, selectedMonth.month + 1, 7)) break;
    }
    return result;
  }, [selectedMonth, meetingDay]);

  const toggleWeek = (date: string) => {
    if (selectedWeeks.includes(date)) {
      onChange(selectedWeeks.filter((w) => w !== date));
    } else {
      onChange([...selectedWeeks, date]);
    }
  };

  // Apply range picker — add all Mondays between start and end
  const applyRange = () => {
    if (!rangeStart) return;
    const start = new Date(rangeStart + "T00:00:00");
    const end = rangeEnd ? new Date(rangeEnd + "T00:00:00") : start;
    const monday = getMonday(start);
    const endMonday = getMonday(end);
    const newWeeks = [...selectedWeeks];
    const cur = new Date(monday);
    while (cur <= endMonday) {
      const ymd = toYMD(cur);
      if (!newWeeks.includes(ymd)) newWeeks.push(ymd);
      cur.setDate(cur.getDate() + 7);
    }
    newWeeks.sort();
    onChange(newWeeks);
  };

  // Auto-apply when both dates are set
  const handleRangeChange = (newStart: string, newEnd: string) => {
    setRangeStart(newStart);
    setRangeEnd(newEnd);
    if (newStart && newEnd) {
      const start = new Date(newStart + "T00:00:00");
      const end = new Date(newEnd + "T00:00:00");
      const monday = getMonday(start);
      const endMonday = getMonday(end);
      const newWeeks = [...selectedWeeks];
      const cur = new Date(monday);
      while (cur <= endMonday) {
        const ymd = toYMD(cur);
        if (!newWeeks.includes(ymd)) newWeeks.push(ymd);
        cur.setDate(cur.getDate() + 7);
      }
      newWeeks.sort();
      onChange(newWeeks);
    }
  };

  const selectAllWeeks = () => {
    if (mode === "weeks") {
      if (selectedWeeks.length === weeks.length) {
        onChange([]);
      } else {
        onChange(weeks.map((w) => w.date));
      }
    } else if (mode === "month") {
      const allMonthDates = monthWeeks.map(w => w.date);
      const allSelected = allMonthDates.every(d => selectedWeeks.includes(d));
      if (allSelected) {
        onChange(selectedWeeks.filter(d => !allMonthDates.includes(d)));
      } else {
        const newWeeks = [...new Set([...selectedWeeks, ...allMonthDates])];
        newWeeks.sort();
        onChange(newWeeks);
      }
    }
  };

  const currentWeeks = mode === "month" ? monthWeeks : weeks;
  const allCurrentSelected = currentWeeks.every(w => selectedWeeks.includes(w.date));

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-0.5">
        <button
          type="button"
          onClick={() => setMode("weeks")}
          className={`flex-1 text-xs font-medium rounded-md py-1.5 transition-colors ${mode === "weeks" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Weeks
        </button>
        <button
          type="button"
          onClick={() => setMode("month")}
          className={`flex-1 text-xs font-medium rounded-md py-1.5 transition-colors ${mode === "month" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Month
        </button>
        <button
          type="button"
          onClick={() => setMode("range")}
          className={`flex-1 text-xs font-medium rounded-md py-1.5 transition-colors ${mode === "range" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Date Range
        </button>
      </div>

      {/* Select all / count */}
      {(mode === "weeks" || mode === "month") && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={selectAllWeeks}
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            {allCurrentSelected ? "Uncheck All" : "Select All"}
          </button>
          {selectedWeeks.length > 0 && (
            <span className="text-xs text-muted-foreground">{selectedWeeks.length} selected</span>
          )}
        </div>
      )}

      {/* Weeks mode */}
      {mode === "weeks" && (
        <div className="space-y-1.5">
          {weeks.map((week) => (
            <label
              key={week.date}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors text-sm ${
                selectedWeeks.includes(week.date)
                  ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300"
                  : "border-border/40 hover:bg-accent"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedWeeks.includes(week.date)}
                onChange={() => toggleWeek(week.date)}
                className="rounded accent-indigo-500"
              />
              {week.label}
            </label>
          ))}
        </div>
      )}

      {/* Month mode */}
      {mode === "month" && (
        <div className="space-y-2">
          {/* Month navigation */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const m = selectedMonth.month - 1;
                if (m < 0) setSelectedMonth({ year: selectedMonth.year - 1, month: 11 });
                else setSelectedMonth({ ...selectedMonth, month: m });
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
            >
              ‹ Prev
            </button>
            <span className="text-sm font-semibold">
              {MONTH_NAMES[selectedMonth.month]} {selectedMonth.year}
            </span>
            <button
              type="button"
              onClick={() => {
                const m = selectedMonth.month + 1;
                if (m > 11) setSelectedMonth({ year: selectedMonth.year + 1, month: 0 });
                else setSelectedMonth({ ...selectedMonth, month: m });
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
            >
              Next ›
            </button>
          </div>
          <div className="space-y-1.5">
            {monthWeeks.map((week) => (
              <label
                key={week.date}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors text-sm ${
                  selectedWeeks.includes(week.date)
                    ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300"
                    : "border-border/40 hover:bg-accent"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedWeeks.includes(week.date)}
                  onChange={() => toggleWeek(week.date)}
                  className="rounded accent-indigo-500"
                />
                {week.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Date range mode — calendar picker */}
      {mode === "range" && (
        <div className="space-y-3">
          <DateRangePicker
            start={rangeStart}
            end={rangeEnd}
            onStartChange={(s) => handleRangeChange(s, rangeEnd)}
            onEndChange={(e) => handleRangeChange(rangeStart, e)}
          />
          {selectedWeeks.length > 0 && (
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 px-3 py-2">
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                {selectedWeeks.length} week{selectedWeeks.length !== 1 ? "s" : ""} selected in range
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {selectedWeeks.slice(0, 6).map(w => {
                  const monday = new Date(w + "T00:00:00");
                  const meetingDate = new Date(monday);
                  meetingDate.setDate(monday.getDate() + meetingDay);
                  return (
                    <span key={w} className="text-[10px] bg-background rounded px-1.5 py-0.5 border border-border/40">
                      {meetingDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  );
                })}
                {selectedWeeks.length > 6 && (
                  <span className="text-[10px] text-muted-foreground">+{selectedWeeks.length - 6} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
