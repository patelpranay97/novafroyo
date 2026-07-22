"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Employee,
  type ScheduledShift,
  type Shift,
  type TipDay,
  addDays,
  fmtDayShort,
  fmtMonthTitle,
  fmtTime,
  fmtTimeChip,
  normalizePhone,
  toDateStr,
} from "@/lib/portal";
import { Card, SectionLabel } from "./ui";
import { DayEditor } from "./day-editor";

type Props = {
  supabase: SupabaseClient;
  employees: Employee[];
  shifts: Shift[];
  tips: TipDay[];
  schedule: ScheduledShift[];
  scheduleReady: boolean;
  onChange: () => Promise<void>;
  notify: (msg: string) => void;
};

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarView({
  supabase,
  employees,
  shifts,
  tips,
  schedule,
  scheduleReady,
  onChange,
  notify,
}: Props) {
  // "Today" is state so a tab left open across midnight re-anchors (the
  // reminders card and today-outline would otherwise go stale).
  const [today, setToday] = useState(() => new Date());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      setToday((prev) =>
        toDateStr(prev) === toDateStr(new Date()) ? prev : new Date(),
      );
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

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

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, ScheduledShift[]>();
    for (const s of schedule) {
      const list = map.get(s.work_date) ?? [];
      list.push(s);
      map.set(s.work_date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [schedule]);

  // Tomorrow's scheduled crew, for the reminder texts.
  const tomorrowStr = toDateStr(addDays(today, 1));
  const tomorrowCrew = useMemo(
    () => scheduleByDate.get(tomorrowStr) ?? [],
    [scheduleByDate, tomorrowStr],
  );

  // Chip label per employee: first name, plus a last initial only when another
  // employee shares that first name (so two "Sam"s stay distinguishable).
  const labelById = useMemo(() => {
    const firstNameCount = new Map<string, number>();
    for (const e of employees) {
      const first = e.name.trim().split(/\s+/)[0];
      firstNameCount.set(first, (firstNameCount.get(first) ?? 0) + 1);
    }
    const map = new Map<string, string>();
    for (const e of employees) {
      const parts = e.name.trim().split(/\s+/);
      const first = parts[0];
      const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : "";
      map.set(
        e.id,
        (firstNameCount.get(first) ?? 0) > 1 && lastInitial
          ? `${first} ${lastInitial}`
          : first,
      );
    }
    return map;
  }, [employees]);

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

      {/* Grid — 10% larger on desktop (wider than the column, taller cells) */}
      <div className="grid grid-cols-7 gap-px border border-charcoal/15 bg-charcoal/15 sm:-ml-[5%] sm:w-[110%]">
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
            <div key={`blank-${i}`} className="min-h-20 bg-cream/60 sm:min-h-[88px]" />
          ) : (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDate(dateStr)}
              className={`flex min-h-20 flex-col items-stretch gap-1 bg-cream-soft p-1 text-left transition hover:bg-cream-deep sm:min-h-[88px] ${
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
              {(() => {
                const worked = shiftsByDate.get(dateStr) ?? [];
                const planned = scheduleByDate.get(dateStr) ?? [];
                const chips = [
                  ...worked.map((s) => ({ kind: "worked" as const, s })),
                  ...planned.map((s) => ({ kind: "planned" as const, s })),
                ];
                return (
                  <>
                    {chips.slice(0, 3).map((c) =>
                      c.kind === "worked" ? (
                        <span
                          key={c.s.id}
                          className="truncate rounded-sm px-1 py-px text-[9px] leading-tight text-cream"
                          style={{
                            background:
                              empById.get(c.s.employee_id)?.color ?? "#999",
                          }}
                        >
                          {labelById.get(c.s.employee_id) ?? "?"}{" "}
                          {Number(c.s.hours)}h
                        </span>
                      ) : (
                        <span
                          key={c.s.id}
                          className="truncate rounded-sm border px-1 py-px text-[9px] leading-tight text-charcoal-soft"
                          style={{
                            borderColor:
                              empById.get(c.s.employee_id)?.color ?? "#999",
                          }}
                        >
                          {labelById.get(c.s.employee_id) ?? "?"}{" "}
                          {fmtTimeChip(c.s.start_time, c.s.end_time)}
                        </span>
                      ),
                    )}
                    {chips.length > 3 && (
                      <span className="px-1 text-[9px] text-muted">
                        +{chips.length - 3} more
                      </span>
                    )}
                  </>
                );
              })()}
            </button>
          ),
        )}
      </div>

      {/* Shift reminders — prefilled texts for tomorrow's scheduled crew */}
      {scheduleReady && (
        <Card>
          <SectionLabel>Shift reminders</SectionLabel>
          {tomorrowCrew.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              No one is scheduled for tomorrow ({fmtDayShort(tomorrowStr)})
              yet. Schedule shifts on the calendar above and one-tap text
              buttons appear here the day before.
            </p>
          ) : (
            <>
          <p className="mt-1 text-[10px] text-muted/80">
            Tomorrow ({fmtDayShort(tomorrowStr)}) — tap to open a prefilled
            text from your phone.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {tomorrowCrew.map((s) => {
              const emp = empById.get(s.employee_id);
              const phone = emp?.phone ? normalizePhone(emp.phone) : null;
              const timeRange = `${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`;
              const body = `Hi ${emp?.name?.split(" ")[0] ?? "there"}! Reminder: you're on at Nova tomorrow (${fmtDayShort(s.work_date)}), ${timeRange}. See you then!`;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: emp?.color ?? "#999" }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{emp?.name ?? "Unknown"}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {timeRange}
                    </span>
                  </span>
                  {phone ? (
                    <a
                      href={`sms:${phone}?&body=${encodeURIComponent(body)}`}
                      className="shrink-0 border border-charcoal bg-charcoal px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cream transition hover:bg-charcoal-soft"
                    >
                      Text
                    </a>
                  ) : (
                    <span className="max-w-24 text-right text-[10px] uppercase leading-tight tracking-[0.1em] text-muted">
                      Add phone on Team tab
                    </span>
                  )}
                </div>
              );
            })}
          </div>
            </>
          )}
        </Card>
      )}

      {selectedDate && (
        <DayEditor
          supabase={supabase}
          date={selectedDate}
          employees={employees}
          shifts={shiftsByDate.get(selectedDate) ?? []}
          scheduled={scheduleByDate.get(selectedDate) ?? []}
          scheduleReady={scheduleReady}
          tip={tipsByDate.get(selectedDate) ?? null}
          onChange={onChange}
          notify={notify}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
