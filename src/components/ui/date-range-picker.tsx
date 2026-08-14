"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD or ""
  endDate: string; // YYYY-MM-DD or ""
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  language?: "en" | "tl";
  weekStartsOn?: 0 | 1 | 6; // 0=Sun, 1=Mon, 6=Sat
  allowSingle?: boolean; // if true, clicking same date twice = single-day range
}

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_TL = ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre"];
const DAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAYS_TL = ["Lin", "Lun", "Mar", "Miy", "Huw", "Biy", "Sab"];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = "Select dates",
  language = "en",
  weekStartsOn = 1,
  allowSingle = true,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const start = parseYMD(startDate);
  const end = parseYMD(endDate);

  const [viewYear, setViewYear] = useState(() => start?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => start?.getMonth() ?? new Date().getMonth());

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const months = language === "tl" ? MONTHS_TL : MONTHS_EN;
  const baseDays = language === "tl" ? DAYS_TL : DAYS_EN;
  const dayLabels = [...baseDays.slice(weekStartsOn), ...baseDays.slice(0, weekStartsOn)];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (dateStr: string) => {
    // Flight-booking logic:
    // - No start, or both set → new selection starts here
    // - Only start set → this click becomes end (swap if before start)
    if (!startDate || (startDate && endDate)) {
      onChange(dateStr, "");
      return;
    }
    if (startDate && !endDate) {
      if (dateStr === startDate && allowSingle) {
        onChange(dateStr, dateStr);
      } else if (dateStr < startDate) {
        onChange(dateStr, startDate);
      } else {
        onChange(startDate, dateStr);
      }
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("", "");
  };

  // Build calendar cells
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const offset = (firstDayOfWeek - weekStartsOn + 7) % 7;

  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = toYMD(new Date());

  const isInRange = (dateStr: string) => {
    if (!startDate) return false;
    if (!endDate) return dateStr === startDate;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const isRangeStart = (dateStr: string) => dateStr === startDate;
  const isRangeEnd = (dateStr: string) => endDate !== "" && dateStr === endDate;

  const formatDisplay = (s: string) => {
    const d = parseYMD(s);
    if (!d) return "";
    return d.toLocaleDateString(language === "tl" ? "fil-PH" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  let displayText = placeholder;
  if (startDate && endDate && startDate !== endDate) {
    displayText = `${formatDisplay(startDate)} → ${formatDisplay(endDate)}`;
  } else if (startDate) {
    displayText = formatDisplay(startDate);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
        onClick={() => {
          if (start) {
            setViewYear(start.getFullYear());
            setViewMonth(start.getMonth());
          }
          setOpen(!open);
        }}
      >
        <CalendarDays className="h-4 w-4 mr-2 shrink-0" />
        <span className="truncate flex-1">{displayText}</span>
        {startDate && (
          <X className="h-3.5 w-3.5 ml-1 shrink-0 text-muted-foreground hover:text-foreground" onClick={clear} />
        )}
      </Button>

      {open && (
        <div className="absolute z-[100] mt-1 p-3 rounded-lg border bg-popover shadow-md w-72">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">
              {months[viewMonth]} {viewYear}
            </span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {dayLabels.map((d, i) => (
              <div key={i} className="text-center text-[11px] font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={i} className="h-8" />;
              const day = parseInt(dateStr.split("-")[2], 10);
              const inRange = isInRange(dateStr);
              const rangeStart = isRangeStart(dateStr);
              const rangeEnd = isRangeEnd(dateStr);
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayClick(dateStr)}
                  className={cn(
                    "h-8 w-full text-sm transition-colors",
                    inRange && !rangeStart && !rangeEnd && "bg-blue-100 dark:bg-blue-900/40",
                    rangeStart && "bg-blue-600 text-white rounded-l-full",
                    rangeEnd && "bg-blue-600 text-white rounded-r-full",
                    rangeStart && rangeEnd && "rounded-full",
                    rangeStart && !endDate && "rounded-full",
                    !inRange && "hover:bg-accent rounded-full",
                    isToday && !inRange && "font-bold text-blue-600"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer hint + actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
            <span>
              {!startDate
                ? language === "tl" ? "Piliin ang unang petsa" : "Pick start date"
                : !endDate
                  ? language === "tl" ? "Piliin ang huling petsa" : "Pick end date"
                  : language === "tl" ? "I-click ulit para baguhin" : "Click to start over"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setOpen(false)}
            >
              {language === "tl" ? "Tapos na" : "Done"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
