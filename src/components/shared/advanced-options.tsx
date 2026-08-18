"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import type { DateRange } from "react-day-picker";

const LocationPicker = dynamic(() => import("@/components/location-picker").then(m => m.LocationPicker), { ssr: false });

export interface AdvancedOptionsState {
  isPinned: boolean;
  expiresAt: string;
  showOnCalendar: boolean;
  eventStartDate: string;
  eventEndDate: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  isPublished: boolean;
}

interface AdvancedOptionsProps {
  state: AdvancedOptionsState;
  onChange: (state: AdvancedOptionsState) => void;
  showPin?: boolean;
  showExpiry?: boolean;
  showCalendar?: boolean;
  showLocation?: boolean;
  showPublished?: boolean;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromYMD(s: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

export function AdvancedOptions({
  state,
  onChange,
  showPin = true,
  showExpiry = true,
  showCalendar = true,
  showLocation = true,
  showPublished = false,
}: AdvancedOptionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(!!state.location);

  const hasAnyOption = showPin || showExpiry || showCalendar || showLocation || showPublished;
  if (!hasAnyOption) return null;

  // Build the DateRange for the calendar from state
  const selectedRange: DateRange | undefined = state.eventStartDate
    ? {
        from: fromYMD(state.eventStartDate),
        to: state.eventEndDate ? fromYMD(state.eventEndDate) : undefined,
      }
    : undefined;

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range) {
      onChange({ ...state, eventStartDate: "", eventEndDate: "" });
      return;
    }
    if (range.from && !range.to) {
      onChange({ ...state, eventStartDate: toYMD(range.from), eventEndDate: "" });
    }
    if (range.from && range.to) {
      onChange({
        ...state,
        eventStartDate: toYMD(range.from),
        eventEndDate: toYMD(range.to),
      });
    }
  };

  // Format the selected range for display
  const rangeLabel = state.eventStartDate
    ? state.eventEndDate
      ? `${state.eventStartDate} → ${state.eventEndDate}`
      : `${state.eventStartDate} (single day)`
    : "Click a start date, then end date";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Options
      </button>

      {expanded && (
        <div className="space-y-3 rounded-xl border border-border/40 p-3 bg-muted/10">
          {showPublished && (
            <div className="flex items-center justify-between">
              <Label className="text-sm cursor-pointer">Published</Label>
              <Switch
                checked={state.isPublished !== false}
                onCheckedChange={(v) => onChange({ ...state, isPublished: v })}
              />
            </div>
          )}

          {showPin && (
            <div className="flex items-center justify-between">
              <Label className="text-sm cursor-pointer">Pin to top</Label>
              <Switch
                checked={state.isPinned}
                onCheckedChange={(v) => onChange({ ...state, isPinned: v })}
              />
            </div>
          )}

          {showExpiry && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm cursor-pointer">Add expiry date</Label>
                <Switch
                  checked={!!state.expiresAt}
                  onCheckedChange={(v) => onChange({ ...state, expiresAt: v ? state.expiresAt || new Date().toISOString().split("T")[0] : "" })}
                />
              </div>
              {state.expiresAt && (
                <Input
                  type="date"
                  value={state.expiresAt}
                  onChange={(e) => onChange({ ...state, expiresAt: e.target.value })}
                  className="rounded-lg text-sm"
                />
              )}
            </div>
          )}

          {showLocation && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm cursor-pointer flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Add location
                </Label>
                <Switch
                  checked={locationEnabled || !!state.location}
                  onCheckedChange={(v) => {
                    setLocationEnabled(v);
                    if (!v) {
                      onChange({ ...state, location: "", latitude: null, longitude: null });
                    }
                  }}
                />
              </div>
              {(locationEnabled || !!state.location) && (
                <LocationPicker
                  location={state.location}
                  latitude={state.latitude}
                  longitude={state.longitude}
                  onChange={(data) => onChange({ ...state, location: data.location, latitude: data.latitude, longitude: data.longitude })}
                />
              )}
            </div>
          )}

          {showCalendar && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm cursor-pointer">Show on calendar</Label>
                <Switch
                  checked={state.showOnCalendar}
                  onCheckedChange={(v) => onChange({ ...state, showOnCalendar: v })}
                />
              </div>
              {state.showOnCalendar && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{rangeLabel}</p>
                  <div className="flex justify-center rounded-lg border border-border/40 p-1 bg-background">
                    <Calendar
                      mode="range"
                      selected={selectedRange}
                      onSelect={handleRangeSelect}
                      numberOfMonths={1}
                      className="scale-90 origin-top"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        onChange({
                          ...state,
                          eventStartDate: toYMD(today),
                          eventEndDate: "",
                        });
                      }}
                      className="rounded-lg text-xs flex-1"
                    >
                      Today
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date();
                        const end = new Date(today);
                        end.setDate(end.getDate() + 6);
                        onChange({
                          ...state,
                          eventStartDate: toYMD(today),
                          eventEndDate: toYMD(end),
                        });
                      }}
                      className="rounded-lg text-xs flex-1"
                    >
                      This week
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const first = new Date(now.getFullYear(), now.getMonth(), 1);
                        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        onChange({
                          ...state,
                          eventStartDate: toYMD(first),
                          eventEndDate: toYMD(last),
                        });
                      }}
                      className="rounded-lg text-xs flex-1"
                    >
                      This month
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onChange({ ...state, eventStartDate: "", eventEndDate: "" })}
                      className="rounded-lg text-xs flex-1"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
