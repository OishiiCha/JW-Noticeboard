"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromYMD(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface DateRangePickerProps {
  // New interface (used by week-selector)
  start?: string;
  end?: string;
  onStartChange?: (start: string) => void;
  onEndChange?: (end: string) => void;
  // Legacy interface (used by special-event-modal)
  startDate?: string;
  endDate?: string;
  onChange?: (start: string, end: string) => void;
  autoEndDays?: number | null;
  overrideAuto?: boolean;
}

export function DateRangePicker({
  start, end, onStartChange, onEndChange,
  startDate, endDate, onChange, autoEndDays, overrideAuto,
}: DateRangePickerProps) {
  // Normalize to a single set of values/callbacks
  const _start = start ?? startDate ?? "";
  const _end = end ?? endDate ?? "";
  const setStart = (s: string) => {
    onStartChange?.(s);
    if (onChange) onChange(s, _end);
  };
  const setEnd = (e: string) => {
    onEndChange?.(e);
    if (onChange) onChange(_start, e);
  };

  const [viewMonth, setViewMonth] = useState(() => {
    const d = fromYMD(_start) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectingEnd, setSelectingEnd] = useState(false);

  const startDateObj = fromYMD(_start);
  const endDateObj = fromYMD(_end);

  const days = useMemo(() => {
    const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    const startWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: (Date | null)[] = [];
    // Leading blanks
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    // Trailing blanks to fill the grid (up to 42 cells = 6 rows)
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [viewMonth]);

  const isInRange = (d: Date) => {
    if (!startDateObj || !endDateObj) return false;
    const t = d.getTime();
    return t >= startDateObj.getTime() && t <= endDateObj.getTime();
  };

  const isStart = (d: Date) => startDateObj && toYMD(d) === toYMD(startDateObj);
  const isEnd = (d: Date) => endDateObj && toYMD(d) === toYMD(endDateObj);

  const handleClick = (d: Date) => {
    // Auto-end feature for conventions (legacy support)
    if (autoEndDays && !overrideAuto && !selectingEnd) {
      const startD = toYMD(d);
      const endD = new Date(d);
      endD.setDate(endD.getDate() + autoEndDays);
      setStart(startD);
      setEnd(toYMD(endD));
      return;
    }

    if (!selectingEnd && !_start) {
      // First click — set start
      setStart(toYMD(d));
      setSelectingEnd(true);
    } else if (!selectingEnd && _start && !_end) {
      // Already have start, clicking again — if before start, set as start; else set as end
      if (d < (startDateObj as Date)) {
        setStart(toYMD(d));
      } else {
        setEnd(toYMD(d));
        setSelectingEnd(false);
      }
    } else if (selectingEnd) {
      // Second click — set end
      if (startDateObj && d < startDateObj) {
        // Clicked before start — swap
        setEnd(toYMD(startDateObj));
        setStart(toYMD(d));
      } else {
        setEnd(toYMD(d));
      }
      setSelectingEnd(false);
    } else {
      // Both set, start over
      setStart(toYMD(d));
      setEnd("");
      setSelectingEnd(true);
    }
  };

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  const goToday = () => {
    const today = new Date();
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <div className="rounded-xl border border-border/40 p-3 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7 rounded-lg">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button onClick={goToday} className="text-sm font-semibold hover:underline">
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </button>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7 rounded-lg">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const inRange = isInRange(d);
          const isStartDay = isStart(d);
          const isEndDay = isEnd(d);
          const isToday = toYMD(d) === toYMD(new Date());
          const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <button
              key={i}
              onClick={() => handleClick(d)}
              className={`
                aspect-square rounded-lg text-xs font-medium transition-colors relative
                ${isStartDay || isEndDay
                  ? "bg-indigo-600 text-white font-bold"
                  : inRange
                    ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                    : isToday
                      ? "ring-1 ring-indigo-400 text-indigo-600 dark:text-indigo-400"
                      : isPast
                        ? "text-muted-foreground/40 hover:bg-accent"
                        : "text-foreground hover:bg-accent"
                }
              `}
            >
              {d.getDate()}
              {(isStartDay || isEndDay) && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] text-white/80">
                  {isStartDay ? "S" : "E"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selection info */}
      <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {_start && (
            <span className="text-muted-foreground">
              {selectingEnd ? "Now select end date" : ""}
              {!selectingEnd && _start && !_end && "Click another date for end"}
              {_start && _end && `${new Date(_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} → ${new Date(_end + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </span>
          )}
          {!_start && <span className="text-muted-foreground">Click to select start date</span>}
        </div>
        {(_start || _end) && (
          <button
            onClick={() => { setStart(""); setEnd(""); setSelectingEnd(false); }}
            className="text-xs text-red-500 hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
