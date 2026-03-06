"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import {
  formatLocalDateTimeFromUtc,
  getTimeZoneOffsetLabel,
  toUtcMsFromZonedLocal,
} from "@/lib/timezone";

type DateTimePopoverProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  timeZone: string;
};

type MonthState = {
  year: number;
  month: number;
};

type CalendarCell = {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseLocal(value: string):
  | { year: number; month: number; day: number; hour: number; minute: number }
  | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(state: MonthState, amount: number): MonthState {
  const monthIndex = state.month - 1 + amount;
  const year = state.year + Math.floor(monthIndex / 12);
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  return { year, month: normalizedMonth + 1 };
}

function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekday + 6) % 7;

  const currentMonthDays = daysInMonth(year, month);
  const prevMonth = shiftMonth({ year, month }, -1);
  const prevMonthDays = daysInMonth(prevMonth.year, prevMonth.month);

  const cells: CalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const dayIndex = index - mondayOffset + 1;
    if (dayIndex < 1) {
      const dayNumber = prevMonthDays + dayIndex;
      cells.push({
        dateKey: `${prevMonth.year}-${pad2(prevMonth.month)}-${pad2(dayNumber)}`,
        dayNumber,
        inCurrentMonth: false,
      });
      continue;
    }

    if (dayIndex > currentMonthDays) {
      const nextMonth = shiftMonth({ year, month }, 1);
      const dayNumber = dayIndex - currentMonthDays;
      cells.push({
        dateKey: `${nextMonth.year}-${pad2(nextMonth.month)}-${pad2(dayNumber)}`,
        dayNumber,
        inCurrentMonth: false,
      });
      continue;
    }

    cells.push({
      dateKey: `${year}-${pad2(month)}-${pad2(dayIndex)}`,
      dayNumber: dayIndex,
      inCurrentMonth: true,
    });
  }

  return cells;
}

function toDisplayText(value: string, timeZone: string): string {
  const ms = toUtcMsFromZonedLocal(value, timeZone);
  if (Number.isNaN(ms)) return "Select date & time";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(ms));
}

export function DateTimePopover({ label, value, onChange, min, timeZone }: DateTimePopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const fallbackNowLocal = useMemo(
    () => formatLocalDateTimeFromUtc(Date.now() / 1_000, timeZone),
    [timeZone],
  );

  const parsed = parseLocal(value || fallbackNowLocal);
  const [viewMonth, setViewMonth] = useState<MonthState>(() => ({
    year: parsed?.year ?? Number(fallbackNowLocal.slice(0, 4)),
    month: parsed?.month ?? Number(fallbackNowLocal.slice(5, 7)),
  }));

  useEffect(() => {
    const current = parseLocal(value);
    if (!current) return;
    setViewMonth({ year: current.year, month: current.month });
  }, [value]);

  const cells = useMemo(
    () => buildCalendarCells(viewMonth.year, viewMonth.month),
    [viewMonth.year, viewMonth.month],
  );

  const selectedDate = value.slice(0, 10);
  const selectedTime = value.slice(11, 16) || "18:00";
  const minDate = min?.slice(0, 10) ?? "";

  const monthLabel = useMemo(() => {
    const monthDate = new Date(Date.UTC(viewMonth.year, viewMonth.month - 1, 1));
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthDate);
  }, [viewMonth.year, viewMonth.month]);

  const displayValue = value ? toDisplayText(value, timeZone) : "Select date & time";

  function commit(datePart: string, timePart: string) {
    const candidate = `${datePart}T${timePart}`;
    if (min && candidate < min) {
      onChange(min.slice(0, 16));
      return;
    }
    onChange(candidate);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-xl border border-white/10 bg-[#6a406f]/70 px-3 py-2 text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span>
            <span className="block text-[11px] text-[#c9b2cb]">{label}</span>
            <span className="mt-0.5 block text-sm font-semibold text-white">{displayValue}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[#d7c0da]">
            <CalendarDays size={14} />
            <Clock3 size={14} />
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(92vw,330px)] rounded-2xl border border-white/15 bg-[#2d1930]/95 p-3 text-white shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[26px] font-semibold">{monthLabel}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMonth((prev) => shiftMonth(prev, -1))}
                className="rounded-md border border-white/15 bg-white/[0.05] p-1.5 text-zinc-200 hover:bg-white/10"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMonth((prev) => shiftMonth(prev, 1))}
                className="rounded-md border border-white/15 bg-white/[0.05] p-1.5 text-zinc-200 hover:bg-white/10"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 pb-1">
            {WEEKDAY_LABELS.map((day, index) => (
              <span key={`${day}-${index}`} className="text-center text-sm font-semibold text-zinc-200">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const isSelected = selectedDate === cell.dateKey;
              const isDisabled = Boolean(minDate && cell.dateKey < minDate);

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => commit(cell.dateKey, selectedTime)}
                  className={`h-9 rounded-md text-base font-semibold transition-colors ${
                    isSelected
                      ? "bg-rose-600 text-white"
                      : cell.inCurrentMonth
                        ? "text-white hover:bg-white/10"
                        : "text-zinc-500 hover:bg-white/5"
                  } ${isDisabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {cell.dayNumber}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Time</label>
              <span className="text-xs text-zinc-400">{getTimeZoneOffsetLabel(timeZone)}</span>
            </div>
            <input
              type="time"
              value={selectedTime}
              onChange={(event) => commit(selectedDate || value.slice(0, 10) || fallbackNowLocal.slice(0, 10), event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#7a527d]/70 px-2.5 py-1 text-sm font-semibold text-white outline-none [color-scheme:dark] focus:border-fuchsia-200"
            />
          </div>
        </div>
      )}
    </div>
  );
}
