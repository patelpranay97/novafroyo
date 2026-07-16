"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Employee,
  type Shift,
  type TipDay,
  addDays,
  fmtDayShort,
  fmtHours,
  fmtMoney,
  fmtWeekRange,
  round2,
  splitProportional,
  startOfWeek,
  sumHours,
  sumPay,
  toDateStr,
  weekDates,
} from "@/lib/portal";
import { Card, SectionLabel, btnCls } from "./ui";

type Props = {
  supabase: SupabaseClient;
  employees: Employee[];
  shifts: Shift[];
  tips: TipDay[];
  onChange: () => Promise<void>;
  notify: (msg: string) => void;
};

export function WeekView({
  supabase,
  employees,
  shifts,
  tips,
  onChange,
  notify,
}: Props) {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const [splitMode, setSplitMode] = useState<"even" | "hours">("even");
  const [splitWays, setSplitWays] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [wageTarget, setWageTarget] = useState<number>(() => {
    if (typeof window === "undefined") return 17;
    const saved = Number(window.localStorage.getItem("nova_wage_target"));
    return saved > 0 ? saved : 17;
  });

  function updateWageTarget(value: string) {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return;
    setWageTarget(v);
    try {
      window.localStorage.setItem("nova_wage_target", String(v));
    } catch {}
  }

  const weekDateStrs = useMemo(() => weekDates(monday), [monday]);
  const weekStart = weekDateStrs[0];
  const weekEnd = weekDateStrs[6];

  const weekShifts = useMemo(
    () => shifts.filter((s) => s.work_date >= weekStart && s.work_date <= weekEnd),
    [shifts, weekStart, weekEnd],
  );

  const empById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  // Employees who worked this week, with their week shifts
  const rows = useMemo(() => {
    const byEmp = new Map<string, Shift[]>();
    for (const s of weekShifts) {
      const list = byEmp.get(s.employee_id) ?? [];
      list.push(s);
      byEmp.set(s.employee_id, list);
    }
    return Array.from(byEmp.entries())
      .map(([empId, empShifts]) => {
        const emp = empById.get(empId);
        const owed = sumPay(empShifts);
        const unpaid = empShifts.filter((s) => !s.paid_at);
        const priorUnpaid = round2(
          sumPay(
            shifts.filter(
              (s) => s.employee_id === empId && s.work_date < weekStart && !s.paid_at,
            ),
          ),
        );
        return {
          emp,
          empId,
          empShifts: empShifts.sort((a, b) =>
            a.work_date.localeCompare(b.work_date),
          ),
          hours: sumHours(empShifts),
          owed,
          unpaidAmount: sumPay(unpaid),
          allPaid: unpaid.length === 0,
          priorUnpaid,
        };
      })
      .sort((a, b) => (a.emp?.name ?? "").localeCompare(b.emp?.name ?? ""));
  }, [weekShifts, shifts, empById, weekStart]);

  const weekTips = useMemo(
    () =>
      round2(
        tips
          .filter((t) => t.work_date >= weekStart && t.work_date <= weekEnd)
          .reduce((sum, t) => sum + Number(t.amount), 0),
      ),
    [tips, weekStart, weekEnd],
  );

  const totalPayroll = useMemo(() => sumPay(weekShifts), [weekShifts]);
  const totalHours = useMemo(() => sumHours(weekShifts), [weekShifts]);
  const totalOutstanding = round2(
    rows.reduce((sum, r) => sum + r.unpaidAmount, 0),
  );

  // The manual "N ways" override is specific to the week being viewed. Reset it
  // when the week changes (render-time reset — the idiomatic alternative to an
  // effect) so the split never carries a stale headcount into another week.
  const [splitWeek, setSplitWeek] = useState(weekStart);
  if (weekStart !== splitWeek) {
    setSplitWeek(weekStart);
    setSplitWays(null);
  }

  const isCurrentWeek = toDateStr(startOfWeek(new Date())) === weekStart;
  const ways = splitWays ?? Math.max(rows.length, 1);

  // Cent-exact by-hours shares (sum equals the pot exactly).
  const hourShares = useMemo(
    () => splitProportional(weekTips, rows.map((r) => r.hours)),
    [weekTips, rows],
  );

  // Each day's tips + how many worked, for the per-day breakdown.
  const tipDays = useMemo(() => {
    return weekDateStrs
      .map((date) => {
        const amount = round2(
          Number(tips.find((t) => t.work_date === date)?.amount ?? 0),
        );
        const workers = new Set(
          weekShifts.filter((s) => s.work_date === date).map((s) => s.employee_id),
        );
        return { date, amount, workerCount: workers.size };
      })
      .filter((d) => d.amount > 0);
  }, [weekDateStrs, tips, weekShifts]);

  // Each employee's weekly tip share = sum of that day's tips split evenly
  // among whoever worked that day. Used for the wage check.
  const tipShareByEmp = useMemo(() => {
    const workersByDate = new Map<string, string[]>();
    for (const s of weekShifts) {
      const arr = workersByDate.get(s.work_date) ?? [];
      if (!arr.includes(s.employee_id)) arr.push(s.employee_id);
      workersByDate.set(s.work_date, arr);
    }
    const share = new Map<string, number>();
    for (const [date, workers] of workersByDate) {
      const dayTip = Number(tips.find((t) => t.work_date === date)?.amount ?? 0);
      if (dayTip <= 0 || workers.length === 0) continue;
      const per = dayTip / workers.length;
      for (const empId of workers) {
        share.set(empId, (share.get(empId) ?? 0) + per);
      }
    }
    return share;
  }, [weekShifts, tips]);

  // Wage check: does wages + tip share clear the target hourly?
  const wageCheck = useMemo(() => {
    return rows.map((r) => {
      const tipShare = tipShareByEmp.get(r.empId) ?? 0;
      const total = r.owed + tipShare;
      const effective = r.hours > 0 ? total / r.hours : 0;
      const shortfall = Math.max(0, round2(wageTarget * r.hours - total));
      return { ...r, tipShare: round2(tipShare), effective, shortfall };
    });
  }, [rows, tipShareByEmp, wageTarget]);

  async function togglePaid(row: (typeof rows)[number]) {
    setBusyId(row.empId);
    const ids = row.empShifts
      .filter((s) => (row.allPaid ? true : !s.paid_at))
      .map((s) => s.id);
    const { error } = await supabase
      .from("shifts")
      .update({ paid_at: row.allPaid ? null : new Date().toISOString() })
      .in("id", ids);
    if (error) notify(`Couldn't update: ${error.message}`);
    else {
      await onChange();
      notify(
        row.allPaid
          ? `${row.emp?.name ?? "Employee"} marked unpaid`
          : `${row.emp?.name ?? "Employee"} paid ${fmtMoney(row.unpaidAmount)}`,
      );
    }
    setBusyId(null);
  }

  async function copySummary() {
    const lines = [
      `NOVA — Week of ${fmtWeekRange(monday)}`,
      ...rows.map(
        (r) =>
          `${r.emp?.name ?? "?"}: ${fmtHours(r.hours)} — ${fmtMoney(r.owed)} — ${
            r.allPaid ? "PAID" : "UNPAID"
          }`,
      ),
      `Payroll: ${fmtMoney(totalPayroll)}`,
      `Tips: ${fmtMoney(weekTips)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      notify("Summary copied");
    } catch {
      notify("Couldn't copy — try again");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Week navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => setMonday(addDays(monday, -7))}
          className="flex h-9 w-9 items-center justify-center border border-charcoal/25 transition hover:bg-charcoal hover:text-cream"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <p className="font-display text-base tracking-[0.08em] sm:text-lg">
            {fmtWeekRange(monday)}
          </p>
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setMonday(startOfWeek(new Date()))}
              className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-muted underline-offset-2 hover:underline"
            >
              Back to this week
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => setMonday(addDays(monday, 7))}
          className="flex h-9 w-9 items-center justify-center border border-charcoal/25 transition hover:bg-charcoal hover:text-cream"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Week totals */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center">
          <SectionLabel>Hours</SectionLabel>
          <p className="mt-1 font-display text-xl">{fmtHours(totalHours)}</p>
        </Card>
        <Card className="text-center">
          <SectionLabel>Payroll</SectionLabel>
          <p className="mt-1 font-display text-xl">{fmtMoney(totalPayroll)}</p>
        </Card>
        <Card className="text-center">
          <SectionLabel>Tips</SectionLabel>
          <p className="mt-1 font-display text-xl">{fmtMoney(weekTips)}</p>
        </Card>
      </div>

      {totalOutstanding > 0 && (
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-[#a04a4a]">
          {fmtMoney(totalOutstanding)} still owed this week
        </p>
      )}

      {/* Per-employee cards */}
      {rows.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-muted">
            No shifts logged this week yet — add them from the Calendar tab.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <Card key={r.empId}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: r.emp?.color ?? "#999" }}
                      aria-hidden="true"
                    />
                    <p className="truncate font-display text-base tracking-[0.06em]">
                      {r.emp?.name ?? "Unknown"}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {fmtHours(r.hours)} · {fmtMoney(r.owed)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.empShifts.map((s) => (
                      <span
                        key={s.id}
                        title={s.note ?? undefined}
                        className="border border-charcoal/15 bg-cream px-2 py-0.5 text-[10px] text-charcoal-soft"
                      >
                        {fmtDayShort(s.work_date)} · {fmtHours(Number(s.hours))}
                        {s.note ? " ✎" : ""}
                      </span>
                    ))}
                  </div>
                  {r.priorUnpaid > 0 && (
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a04a4a]">
                      + {fmtMoney(r.priorUnpaid)} unpaid from earlier weeks
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busyId === r.empId}
                  onClick={() => togglePaid(r)}
                  className={
                    r.allPaid
                      ? "shrink-0 border border-[#5a7d4f] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5a7d4f] transition hover:opacity-70 disabled:opacity-40"
                      : "shrink-0 border border-charcoal bg-charcoal px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cream transition hover:bg-charcoal-soft disabled:opacity-40"
                  }
                >
                  {r.allPaid ? "Paid ✓" : `Pay ${fmtMoney(r.unpaidAmount)}`}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tip splitter */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Tip splitter</SectionLabel>
          <div className="flex border border-charcoal/20">
            {(
              [
                ["even", "Even"],
                ["hours", "By hours"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSplitMode(mode)}
                className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
                  splitMode === mode
                    ? "bg-charcoal text-cream"
                    : "text-muted hover:text-charcoal"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm text-muted">
          {fmtMoney(weekTips)} in tips this week
        </p>

        {weekTips <= 0 ? (
          <p className="mt-2 text-xs text-muted/70">
            Log tips on the Calendar tab and the split shows up here.
          </p>
        ) : splitMode === "even" ? (
          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center border border-charcoal/25">
              <button
                type="button"
                aria-label="Fewer ways"
                onClick={() => setSplitWays(Math.max(1, ways - 1))}
                className="px-3 py-1.5 text-sm transition hover:bg-charcoal hover:text-cream"
              >
                −
              </button>
              <span className="min-w-14 px-2 text-center text-sm">
                {ways} way{ways === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                aria-label="More ways"
                onClick={() => setSplitWays(ways + 1)}
                className="px-3 py-1.5 text-sm transition hover:bg-charcoal hover:text-cream"
              >
                +
              </button>
            </div>
            <p className="font-display text-lg">
              {fmtMoney(Math.floor((weekTips / ways) * 100) / 100)}
              <span className="ml-1.5 text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-muted">
                each
              </span>
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5">
            {rows.length === 0 ? (
              <p className="text-xs text-muted/70">
                No one worked this week, so there&apos;s nothing to split by
                hours.
              </p>
            ) : (
              rows.map((r, i) => (
                <div
                  key={r.empId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: r.emp?.color ?? "#999" }}
                      aria-hidden="true"
                    />
                    {r.emp?.name ?? "Unknown"}
                    <span className="text-xs text-muted">
                      {fmtHours(r.hours)}
                    </span>
                  </span>
                  <span className="font-display">
                    {fmtMoney(hourShares[i] ?? 0)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Tips by day */}
      {tipDays.length > 0 && (
        <Card>
          <SectionLabel>Tips by day</SectionLabel>
          <div className="mt-3 flex flex-col gap-2">
            {tipDays.map((d) => (
              <div
                key={d.date}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-charcoal">{fmtDayShort(d.date)}</span>
                <span className="text-muted">
                  {fmtMoney(d.amount)}
                  {d.workerCount > 0 ? (
                    <>
                      {" · "}
                      {d.workerCount} worked{" · "}
                      <span className="font-semibold text-charcoal">
                        {fmtMoney(
                          Math.floor((d.amount / d.workerCount) * 100) / 100,
                        )}{" "}
                        each
                      </span>
                    </>
                  ) : (
                    <> · no shifts logged</>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Wage check — does everyone clear the target hourly? */}
      {rows.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Wage check</SectionLabel>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Target
              <span className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0"
                  value={wageTarget}
                  onChange={(e) => updateWageTarget(e.target.value)}
                  aria-label="Target hourly wage"
                  className="w-16 border border-charcoal/25 bg-cream py-1 pl-5 pr-1 text-right text-sm normal-case tracking-normal outline-none focus:border-charcoal"
                />
              </span>
              /hr
            </label>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {wageCheck.map((r) => (
              <div
                key={r.empId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: r.emp?.color ?? "#999" }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{r.emp?.name ?? "Unknown"}</span>
                  <span className="shrink-0 text-xs text-muted">
                    ≈ {fmtMoney(r.effective)}/hr
                  </span>
                </span>
                {r.shortfall > 0 ? (
                  <span className="shrink-0 font-semibold text-[#a04a4a]">
                    {fmtMoney(r.shortfall)} short
                  </span>
                ) : (
                  <span className="shrink-0 font-semibold text-[#5a7d4f]">
                    ✓ clears
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted/80">
            Base pay + evenly-split tips vs {fmtMoney(wageTarget)}/hr. “Short” is
            the top-up to reach the target.
          </p>
        </Card>
      )}

      <button type="button" onClick={copySummary} className={btnCls}>
        Copy week summary
      </button>
    </div>
  );
}
