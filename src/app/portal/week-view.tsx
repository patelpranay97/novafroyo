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
  dailyHourTipShares,
  fmtWeekRange,
  planPayout,
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
  const [splitMode, setSplitMode] = useState<"even" | "hours" | "daily">(
    "even",
  );
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

  const weekTipRows = useMemo(
    () => tips.filter((t) => t.work_date >= weekStart && t.work_date <= weekEnd),
    [tips, weekStart, weekEnd],
  );
  const weekTips = useMemo(
    () => round2(weekTipRows.reduce((sum, t) => sum + Number(t.amount), 0)),
    [weekTipRows],
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

  // Daily basis: each day's tips ÷ that day's hours, summed per person.
  const daily = useMemo(
    () => dailyHourTipShares(weekShifts, weekTipRows),
    [weekShifts, weekTipRows],
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

  // Payout plan: tips first bring everyone to the target hourly, the leftover
  // is an end-of-week bonus split by hours, and the owner only adds money
  // when the pool can't fund the guarantee.
  const payout = useMemo(
    () =>
      planPayout(
        rows.map((r) => ({
          id: r.empId,
          hours: r.hours,
          wages: r.owed,
          isOwner: r.emp?.is_owner ?? false,
        })),
        weekTips,
        wageTarget,
      ),
    [rows, weekTips, wageTarget],
  );

  // A by-hours starting point for distributing the leftover (owner's call).
  const leftoverSuggestion = useMemo(() => {
    if (payout.leftover <= 0) return [];
    const shares = splitProportional(
      payout.leftover,
      rows.map((r) => r.hours),
    );
    return rows.map((r, i) => ({
      name: (r.emp?.name ?? "?").split(" ")[0],
      share: shares[i] ?? 0,
    }));
  }, [payout.leftover, rows]);

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
          : `${row.emp?.name ?? "Employee"} marked paid`,
      );
    }
    setBusyId(null);
  }

  async function copySummary() {
    const lines = [
      `NOVA — Week of ${fmtWeekRange(monday)} (@ ${fmtMoney(wageTarget)}/hr)`,
      ...payout.perPerson.map((p, i) => {
        const r = rows[i];
        if (p.isOwner) {
          return `${r.emp?.name ?? "?"} (owner): from the leftover — ${fmtHours(r.hours)}`;
        }
        const extra =
          p.ownerAdds > 0 ? ` + ${fmtMoney(p.ownerAdds)} from you` : "";
        return `${r.emp?.name ?? "?"}: PAY ${fmtMoney(p.total)} (${fmtMoney(r.owed)} wages + ${fmtMoney(p.fromTips)} tips${extra}) — ${fmtHours(r.hours)} — ${r.allPaid ? "PAID" : "UNPAID"}`;
      }),
      `Wages ${fmtMoney(totalPayroll)} · Tips ${fmtMoney(weekTips)}`,
      payout.covered
        ? `Staff covered · ${fmtMoney(payout.leftover)} left over — owner decides`
        : `You add ${fmtMoney(payout.ownerAdds)} to reach ${fmtMoney(wageTarget)}/hr`,
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

      {/* Pay your team — ONE number per person: wages + tips (+ top-up) */}
      {rows.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-muted">
            No shifts logged this week yet — add them from the Calendar tab.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Pay your team</SectionLabel>
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
          <p className="mt-1 text-[10px] leading-relaxed text-muted/80">
            The big number is what each staff member takes home — wages +
            tips, with tips first guaranteeing {fmtMoney(wageTarget)}/hr.
            What&apos;s left after that is the owner&apos;s to distribute.
          </p>

          {payout.covered ? (
            <>
              <p className="mt-2 text-sm font-semibold text-[#5a7d4f]">
                ✓ Staff covered to {fmtMoney(wageTarget)}/hr
                {payout.leftover > 0 && (
                  <> · {fmtMoney(payout.leftover)} left over — owner decides</>
                )}
              </p>
              {leftoverSuggestion.length > 0 && (
                <p className="mt-1 text-[10px] leading-relaxed text-muted/80">
                  By-hours starting point:{" "}
                  {leftoverSuggestion
                    .map((s) => `${s.name} ${fmtMoney(s.share)}`)
                    .join(" · ")}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-[#a04a4a]">
              Tips cover {fmtMoney(payout.tipsToGuarantee)} of{" "}
              {fmtMoney(payout.totalNeed)} staff need — you add{" "}
              {fmtMoney(payout.ownerAdds)}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-4">
            {rows.map((r, i) => {
              const p = payout.perPerson[i];
              const partiallyPaid =
                !r.allPaid && r.empShifts.some((s) => s.paid_at);
              return (
                <div
                  key={r.empId}
                  className="border-t border-charcoal/10 pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: r.emp?.color ?? "#999" }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-display text-base tracking-[0.06em]">
                        {r.emp?.name ?? "Unknown"}
                      </span>
                      {p?.isOwner && (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#6d5a8a]">
                          Owner
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-display text-xl">
                      {p?.isOwner
                        ? r.owed > 0
                          ? fmtMoney(r.owed)
                          : "—"
                        : fmtMoney(p?.total ?? r.owed)}
                    </span>
                  </div>
                  <p className="ml-4 mt-0.5 text-xs text-muted">
                    {p?.isOwner ? (
                      <>
                        Takes from what&apos;s left, at her discretion ·{" "}
                        {fmtHours(r.hours)}
                        {r.owed > 0 && <> · {fmtMoney(r.owed)} wages</>}
                      </>
                    ) : (
                      <>
                        {fmtMoney(r.owed)} wages + {fmtMoney(p?.fromTips ?? 0)}{" "}
                        tips
                        {p && p.ownerAdds > 0 && (
                          <>
                            {" + "}
                            <span className="font-semibold text-[#a04a4a]">
                              {fmtMoney(p.ownerAdds)} from you
                            </span>
                          </>
                        )}
                        {" · "}
                        {fmtHours(r.hours)}
                        {p?.effective != null && (
                          <> · ≈{fmtMoney(p.effective)}/hr</>
                        )}
                      </>
                    )}
                  </p>
                  <div className="ml-4 mt-2 flex flex-wrap items-center gap-1.5">
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
                    <button
                      type="button"
                      disabled={busyId === r.empId}
                      onClick={() => togglePaid(r)}
                      className={
                        r.allPaid
                          ? "ml-auto shrink-0 border border-[#5a7d4f] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5a7d4f] transition hover:opacity-70 disabled:opacity-40"
                          : "ml-auto shrink-0 border border-charcoal bg-charcoal px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cream transition hover:bg-charcoal-soft disabled:opacity-40"
                      }
                    >
                      {r.allPaid
                        ? "Paid ✓"
                        : partiallyPaid
                          ? "Mark rest paid"
                          : "Mark paid"}
                    </button>
                  </div>
                  {r.priorUnpaid > 0 && (
                    <p className="ml-4 mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a04a4a]">
                      + {fmtMoney(r.priorUnpaid)} unpaid from earlier weeks
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Optional tip math — collapsed so payroll stays one clear number */}
      <details className="group">
        <summary className="cursor-pointer list-none text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-muted transition hover:text-charcoal">
          <span className="group-open:hidden">▸ Show tip math</span>
          <span className="hidden group-open:inline">▾ Hide tip math</span>
        </summary>
        <p className="mt-2 text-center text-[10px] text-muted/70">
          For comparison only — the amounts to pay are in “Pay your team”
          above.
        </p>
        <div className="mt-3 flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Tip splitter</SectionLabel>
          <div className="flex border border-charcoal/20">
            {(
              [
                ["even", "Even"],
                ["hours", "Wk hours"],
                ["daily", "Daily"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSplitMode(mode)}
                className={`whitespace-nowrap px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] transition sm:px-3 sm:tracking-[0.2em] ${
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
        <p className="mt-0.5 text-[10px] text-muted/70">
          {splitMode === "even"
            ? "Whole week's tips, equal cut per person."
            : splitMode === "hours"
              ? "Whole week's tips ÷ each person's weekly hours."
              : "Each day's tips ÷ that day's hours, summed for the week."}
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
                    {fmtMoney(
                      splitMode === "daily"
                        ? (daily.shares.get(r.empId) ?? 0)
                        : (hourShares[i] ?? 0),
                    )}
                  </span>
                </div>
              ))
            )}
            {splitMode === "daily" && daily.unallocated > 0 && (
              <p className="mt-1 text-[10px] text-[#a04a4a]">
                {fmtMoney(daily.unallocated)} came in on days with no shifts
                logged, so it isn&apos;t split — add those shifts on the
                Calendar tab.
              </p>
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
                      <span className="text-[10px] text-muted/70"> (even)</span>
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

        </div>
      </details>

      <button type="button" onClick={copySummary} className={btnCls}>
        Copy week summary
      </button>
    </div>
  );
}
