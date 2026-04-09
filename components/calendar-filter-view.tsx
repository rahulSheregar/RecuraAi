"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CalendarViewMode = "day" | "week" | "month" | "year";

/** Sunday-first weeks (common in US calendar UIs). */
const WEEK_STARTS_ON = 0 as const;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function periodTitle(mode: CalendarViewMode, anchor: Date) {
  if (mode === "day") return format(anchor, "EEEE, MMMM d, yyyy");
  if (mode === "month") return format(anchor, "MMMM yyyy");
  if (mode === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
    const end = endOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
    if (isSameMonth(start, end)) {
      return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
    }
    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }
  return format(anchor, "yyyy");
}

function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function MonthGrid({
  anchorMonth,
  selected,
  onSelectDay,
}: {
  anchorMonth: Date;
  selected: Date | undefined;
  onSelectDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(anchorMonth);
  const monthEnd = endOfMonth(anchorMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks = chunkWeeks(days);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border">
      <div className="grid w-full grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-border border-r py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div
          key={wi}
          className="grid w-full grid-cols-7 border-border border-b last:border-b-0"
        >
          {week.map((day) => {
            const inMonth = isSameMonth(day, anchorMonth);
            const sel = selected && isSameDay(day, selected);
            const today = isToday(day);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelectDay(day)}
                className={cn(
                  "flex min-h-[6.5rem] w-full min-w-0 flex-col items-stretch border-border border-r p-1.5 text-left transition-colors last:border-r-0 hover:bg-muted/30 sm:min-h-[7.5rem] md:min-h-[8.5rem]",
                  !inMonth && "bg-muted/25 text-muted-foreground",
                  sel && "bg-primary/10 ring-1 ring-primary/40 ring-inset",
                )}
              >
                <div className="flex shrink-0 items-center justify-between gap-1">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center text-sm font-medium tabular-nums",
                      today &&
                        "rounded-full bg-primary text-primary-foreground shadow-sm",
                      !today && sel && "rounded-full bg-primary/20 text-primary",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                {/* Event list area — wire events here later */}
                <div className="mt-1 flex min-h-[2.5rem] flex-1 flex-col gap-0.5 overflow-hidden text-left text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                  <span className="sr-only">Events for {format(day, "PPP")}</span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DayTimeline({ day }: { day: Date }) {
  const hours = React.useMemo(
    () => Array.from({ length: 24 }, (_, h) => h),
    [],
  );

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/40 px-3 py-2 text-center text-sm font-medium">
        {format(day, "EEEE, MMMM d, yyyy")}
      </div>
      <div className="max-h-[min(70vh,600px)] overflow-y-auto">
        {hours.map((h) => {
          const slot = setHours(startOfDay(day), h);
          return (
            <div
              key={h}
              className="grid grid-cols-[3.75rem_1fr] border-border/80 border-b text-sm last:border-b-0"
            >
              <div className="border-border/60 border-r bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground tabular-nums sm:text-xs">
                {format(slot, "h:mm a")}
              </div>
              <div className="relative min-h-11 bg-background/40 p-1 sm:min-h-12">
                {/* Hour block for future events */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarFilterView({
  className,
  initialDate,
}: {
  className?: string;
  initialDate?: Date;
}) {
  const [mode, setMode] = React.useState<CalendarViewMode>("month");
  const [anchor, setAnchor] = React.useState(() => startOfMonth(initialDate ?? new Date()));
  const [selected, setSelected] = React.useState<Date | undefined>(
    () => initialDate ?? new Date(),
  );

  const goToday = () => {
    const t = new Date();
    setSelected(t);
    setAnchor(
      mode === "month"
        ? startOfMonth(t)
        : mode === "year"
          ? startOfMonth(t)
          : t,
    );
  };

  const goPrev = () => {
    setAnchor((d) => {
      if (mode === "day") return addDays(d, -1);
      if (mode === "month") return addMonths(d, -1);
      if (mode === "week") return addWeeks(d, -1);
      return addYears(d, -1);
    });
  };

  const goNext = () => {
    setAnchor((d) => {
      if (mode === "day") return addDays(d, 1);
      if (mode === "month") return addMonths(d, 1);
      if (mode === "week") return addWeeks(d, 1);
      return addYears(d, 1);
    });
  };

  const monthForGrid = startOfMonth(anchor);
  const weekStart = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const year = anchor.getFullYear();
  const yearMonths = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)),
    [year],
  );

  const title = periodTitle(mode, anchor);

  const navLabel =
    mode === "day"
      ? "day"
      : mode === "week"
        ? "week"
        : mode === "month"
          ? "month"
          : "year";

  return (
    <div
      className={cn(
        "flex w-full max-w-none flex-col gap-4 rounded-xl border border-border bg-card/80 p-3 shadow-sm backdrop-blur-sm sm:p-4",
        className,
      )}
    >
      <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={goToday}>
            Today
          </Button>
          <div className="flex min-w-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={goPrev}
              aria-label={`Previous ${navLabel}`}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="min-w-0 flex-1 text-center text-base font-semibold tabular-nums sm:text-lg">
              {title}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={goNext}
              aria-label={`Next ${navLabel}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center justify-end lg:w-auto">
          <Select
            value={mode}
            onValueChange={(v) => {
              const next = v as CalendarViewMode;
              if (next === "day") {
                setAnchor(startOfDay(selected ?? new Date()));
              }
              setMode(next);
            }}
          >
            <SelectTrigger className="w-full min-w-[10rem] sm:w-[11rem]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {mode === "month" && (
        <MonthGrid
          anchorMonth={monthForGrid}
          selected={selected}
          onSelectDay={(d) => {
            setSelected(d);
            setAnchor(startOfMonth(d));
          }}
        />
      )}

      {mode === "day" && (
        <DayTimeline day={startOfDay(anchor)} />
      )}

      {mode === "week" && (
        <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-muted/10">
          <div className="grid min-w-full grid-cols-7 gap-0 divide-x divide-border">
            {weekDays.map((day) => {
              const sel = selected && isSameDay(day, selected);
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className="flex min-w-0 flex-col gap-1 p-2"
                >
                  <span className="text-muted-foreground text-center text-[0.65rem] font-semibold uppercase sm:text-[0.7rem]">
                    {format(day, "EEE")}
                  </span>
                  <Button
                    type="button"
                    variant={sel ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-9 w-full min-w-0 px-0 font-medium tabular-nums",
                      today && !sel && "border-primary/50 bg-primary/5",
                    )}
                    onClick={() => {
                      setSelected(day);
                      setAnchor(day);
                    }}
                  >
                    {format(day, "d")}
                  </Button>
                  <div className="mt-1 min-h-[3rem] flex-1 rounded-md border border-dashed border-border/60 bg-muted/20" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "year" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {yearMonths.map((m) => {
            const inMonth = selected && isSameMonth(m, selected);
            return (
              <Button
                key={m.getMonth()}
                type="button"
                variant={inMonth ? "default" : "outline"}
                className="h-auto flex-col gap-0.5 py-3 font-medium"
                onClick={() => {
                  setAnchor(startOfMonth(m));
                  setSelected(m);
                  setMode("month");
                }}
              >
                <span>{format(m, "MMMM")}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {format(m, "yyyy")}
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
