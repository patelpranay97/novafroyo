"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Employee,
  type Shift,
  type TipDay,
  fmtMonthTitle,
  toDateStr,
} from "@/lib/portal";
import { DayEditor } from "./day-editor";

type Props = {
  supabase: SupabaseClient;
  employees: Employee[];
  shifts: Shift[];
  tips: TipDay[];
  onChange: () => Promise<void>;
  notify: (msg: string) => void;
};

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarView({
  supabase,
  employees,
  shifts,
  tips,
  onChange,
  notify,
}: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStr = toDateStr(today);

  const empById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const list = map.get(s.work_date) ?? [];
      list.push(s);
      map.set(s.work_date, list);
    }
    return map;
  }, [shifts]);

  const tipsByDate = useMemo(
    () => new Map(tips.map((t) => [t.work_date, t])),
    [tips],
  );

  // Build the month grid: leading blanks (Monday-start), then each day.
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = (first.getDay() + 6) % 7;
    const out: (string | null)[] = Array(leadingBlanks).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(toDateStr(new Date(year, month, d)));
    }
    return out;
  }, [year, month]);

  function moveMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
          className="flex h-9 w-9 items-center justify-center border border-charcoal/25 transition hover:bg-charcoal hover:text-cream"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="font-display text-base tracking-[0.08em] sm:text-lg">
          {fmtMonthTitle(year, month)}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => moveMonth(1)}
          className="flex h-9 w-9 items-center justify-center border border-charcoal/25 transition hover:bg-charcoal hover:text-cream"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <p className="text-center text-[10px] text-muted">
        Tap a day to log who worked and the tips.
      </p>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px border border-charcoal/15 bg-charcoal/15">
        {DAY_HEADERS.map((h, i) => (
          <div
            key={`${h}-${i}`}
            className="bg-cream py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-muted"
          >
            {h}
          </div>
        ))}
        {cells.map((dateStr, i) =>
          dateStr === null ? (
            <div key={`blank-${i}`} className="min-h-20 bg-cream/60" />
          ) : (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDate(dateStr)}
              className={`flex min-h-20 flex-col items-stretch gap-1 bg-cream-soft p-1 text-left transition hover:bg-cream-deep ${
                dateStr === todayStr ? "outline outline-1 -outline-offset-1 outline-charcoal" : ""
              }`}
            >
              <span className="flex items-center justify-between px-0.5">
                <span
                  className={`text-[11px] ${
                    dateStr === todayStr
                      ? "font-bold text-charcoal"
                      : "text-charcoal-soft"
                  }`}
                >
                  {Number(dateStr.slice(8))}
                </span>
                {tipsByDate.has(dateStr) && (
                  <span className="text-[9px] font-semibold text-[#5a7d4f]">
                    ${Number(tipsByDate.get(dateStr)!.amount).toFixed(0)}
                  </span>
                )}
              </span>
              {(shiftsByDate.get(dateStr) ?? []).slice(0, 3).map((s) => {
                const emp = empById.get(s.employee_id);
                return (
                  <span
                    key={s.id}
                    className="truncate rounded-sm px-1 py-px text-[9px] leading-tight text-cream"
                    style={{ background: emp?.color ?? "#999" }}
                  >
                    {(emp?.name ?? "?").split(" ")[0]} {Number(s.hours)}h
                  </span>
                );
              })}
              {(shiftsByDate.get(dateStr)?.length ?? 0) > 3 && (
                <span className="px-1 text-[9px] text-muted">
                  +{shiftsByDate.get(dateStr)!.length - 3} more
                </span>
              )}
            </button>
          ),
        )}
      </div>

      {selectedDate && (
        <DayEditor
          supabase={supabase}
          date={selectedDate}
          employees={employees}
          shifts={shiftsByDate.get(selectedDate) ?? []}
          tip={tipsByDate.get(selectedDate) ?? null}
          onChange={onChange}
          notify={notify}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
