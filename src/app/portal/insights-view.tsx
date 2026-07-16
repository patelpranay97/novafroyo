"use client";

import { useEffect, useState } from "react";
import {
  type Employee,
  type Shift,
  type TipDay,
  fmtMoney,
  fmtHours,
  parseDateStr,
  toDateStr,
} from "@/lib/portal";
import {
  employeeStats,
  monthTotals,
  pctDelta,
  records,
  tipsByWeekday,
  unpaidAging,
  weeklyTrend,
} from "@/lib/insights";
import { Card, SectionLabel } from "./ui";

// Chart hues — validated (dataviz six checks) against the cream surface.
const HUE_TIPS = "#2d4f9e"; // aegean
const HUE_PAYROLL = "#b07d3f"; // honey

type Props = {
  employees: Employee[];
  shifts: Shift[];
  tips: TipDay[];
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtDateLong(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  if (pct === 0) {
    // Flat (or a sub-0.5% move rounded to 0) — neutral, never an up-arrow.
    return <span className="text-[10px] font-semibold text-muted">— 0%</span>;
  }
  const up = pct > 0;
  return (
    <span
      className={`text-[10px] font-semibold ${up ? "text-[#5a7d4f]" : "text-[#a04a4a]"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/**
 * Grouped column chart built from divs (responsive, crisp at 375px).
 * Marks: ≤24px thick, 4px rounded data-end, square baseline, 2px surface
 * gaps; hairline baseline; values wear ink, never the series color.
 * Tap/hover a group → detail line below the plot (the tooltip layer).
 */
function ColumnChart({
  groups,
  colors,
  detail,
  ariaLabel,
}: {
  groups: { label: string; values: number[] }[];
  colors: string[];
  detail: (i: number) => string;
  ariaLabel: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  // Data can be refetched under a mounted chart (token refresh, edits from
  // another device); a remembered index past the new length must not crash.
  const validSel = sel !== null && sel < groups.length ? sel : null;
  const max = Math.max(...groups.flatMap((g) => g.values), 0);
  const maxGroup = groups.reduce(
    (best, g, i) =>
      Math.max(...g.values) > Math.max(...(groups[best]?.values ?? [0]))
        ? i
        : best,
    0,
  );
  const H = 112; // plot height px
  if (max <= 0) return null;
  return (
    <div role="img" aria-label={ariaLabel}>
      <p className="mb-1 text-[9px] text-muted/70">{fmtMoney(max)} max</p>
      <div className="flex items-end gap-1 border-b border-charcoal/15">
        {groups.map((g, i) => (
          <button
            key={g.label + i}
            type="button"
            onClick={() => setSel(validSel === i ? null : i)}
            aria-label={detail(i)}
            className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-0"
            style={{ height: H + 16 }}
          >
            {i === maxGroup && (
              <span className="mb-0.5 text-[9px] font-semibold text-charcoal">
                {fmtMoney(Math.max(...g.values))}
              </span>
            )}
            <span className="flex w-full items-end justify-center gap-[2px]">
              {g.values.map((v, j) => (
                <span
                  key={j}
                  className="block max-w-6 flex-1 rounded-t-[4px] transition-opacity"
                  style={{
                    height: Math.max(v > 0 ? 3 : 0, (v / max) * H),
                    background: colors[j],
                    opacity: validSel === null || validSel === i ? 1 : 0.35,
                  }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {groups.map((g, i) => (
          <span
            key={g.label + i}
            className={`min-w-0 flex-1 text-center text-[9px] ${
              validSel === i ? "font-bold text-charcoal" : "text-muted"
            }`}
          >
            {g.label}
          </span>
        ))}
      </div>
      <p className="mt-2 min-h-4 text-center text-[11px] text-charcoal">
        {validSel !== null ? detail(validSel) : ""}
      </p>
    </div>
  );
}

export function InsightsView({ employees, shifts, tips }: Props) {
  // Stable within a render, but re-anchored when the calendar day changes
  // while the tab sits open (e.g. left open across midnight or month-end).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const check = () => {
      setNow((prev) =>
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
  const thisMonth = monthTotals(shifts, tips, now.getFullYear(), now.getMonth());
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthTotals(shifts, tips, prev.getFullYear(), prev.getMonth());
  const weekdays = tipsByWeekday(shifts, tips);
  const weeks = weeklyTrend(shifts, tips, now);
  const team = employeeStats(employees, shifts, tips);
  const aging = unpaidAging(shifts);
  const recs = records(tips);

  const hasAnyData = shifts.length > 0 || tips.length > 0;
  // Must match the chart's own render condition (max avgTips > 0), or the
  // card header promises a chart that never appears.
  const weekdayChartHasBars = weekdays.some((w) => w.avgTips > 0);

  if (!hasAnyData) {
    return (
      <Card className="py-12 text-center">
        <p className="text-sm text-muted">
          Log a few days of shifts and tips — your numbers show up here.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* KPI tiles — this month vs last */}
      <div>
        <SectionLabel>
          {MONTH_NAMES[now.getMonth()]} so far · vs {MONTH_NAMES[prev.getMonth()].slice(0, 3)}
        </SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Card className="text-center">
            <SectionLabel>Tips</SectionLabel>
            <p className="mt-1 font-display text-xl">{fmtMoney(thisMonth.tips)}</p>
            <Delta pct={pctDelta(thisMonth.tips, lastMonth.tips)} />
          </Card>
          <Card className="text-center">
            <SectionLabel>Payroll</SectionLabel>
            <p className="mt-1 font-display text-xl">
              {fmtMoney(thisMonth.payroll)}
            </p>
            <Delta pct={pctDelta(thisMonth.payroll, lastMonth.payroll)} />
          </Card>
          <Card className="text-center">
            <SectionLabel>Hours</SectionLabel>
            <p className="mt-1 font-display text-xl">
              {fmtHours(thisMonth.hours)}
            </p>
            <Delta pct={pctDelta(thisMonth.hours, lastMonth.hours)} />
          </Card>
          <Card className="text-center">
            <SectionLabel>Tips per hour</SectionLabel>
            <p className="mt-1 font-display text-xl">
              {thisMonth.tipsPerHour === null
                ? "—"
                : fmtMoney(thisMonth.tipsPerHour)}
            </p>
            {thisMonth.tipsPerHour !== null &&
              lastMonth.tipsPerHour !== null && (
                <Delta
                  pct={pctDelta(thisMonth.tipsPerHour, lastMonth.tipsPerHour)}
                />
              )}
          </Card>
        </div>
      </div>

      {/* Tips by weekday */}
      {weekdayChartHasBars && (
        <Card>
          <SectionLabel>Average tips by day of week</SectionLabel>
          <p className="mb-3 mt-1 text-[10px] text-muted/80">
            Your busiest days — tap a bar for detail.
          </p>
          <ColumnChart
            ariaLabel="Average tips for each day of the week"
            groups={weekdays.map((w) => ({
              label: w.label,
              values: [w.avgTips],
            }))}
            colors={[HUE_TIPS]}
            detail={(i) => {
              const w = weekdays[i];
              if (w.daysCounted === 0) return `${w.label} · no tips logged yet`;
              return `${w.label} · avg ${fmtMoney(w.avgTips)} over ${w.daysCounted} day${w.daysCounted === 1 ? "" : "s"}${
                w.tipsPerLaborHour !== null
                  ? ` · ${fmtMoney(w.tipsPerLaborHour)}/labor-hr`
                  : ""
              }`;
            }}
          />
        </Card>
      )}

      {/* Weekly trend */}
      {weeks.some((w) => w.tips > 0 || w.payroll > 0) && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Weekly trend</SectionLabel>
            <span className="flex items-center gap-3 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: HUE_TIPS }}
                  aria-hidden="true"
                />
                Tips
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: HUE_PAYROLL }}
                  aria-hidden="true"
                />
                Payroll
              </span>
            </span>
          </div>
          <p className="mb-3 mt-1 text-[10px] text-muted/80">
            Tips vs labor cost, week by week (Mon–Sun).
          </p>
          <ColumnChart
            ariaLabel="Weekly tips and payroll totals"
            groups={weeks.map((w) => ({
              label: w.label,
              values: [w.tips, w.payroll],
            }))}
            colors={[HUE_TIPS, HUE_PAYROLL]}
            detail={(i) => {
              const w = weeks[i];
              return `Wk of ${w.label} · tips ${fmtMoney(w.tips)} · payroll ${fmtMoney(w.payroll)} · ${fmtHours(w.hours)}`;
            }}
          />
        </Card>
      )}

      {/* Team stats */}
      {team.length > 0 && (
        <Card>
          <SectionLabel>Team · all time</SectionLabel>
          <div className="mt-3 flex flex-col gap-2">
            {team.map((t) => (
              <div key={t.empId} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: t.color }}
                      aria-hidden="true"
                    />
                    <span
                      className={`truncate ${t.active ? "" : "text-muted"}`}
                    >
                      {t.name}
                    </span>
                  </span>
                  {t.effectiveHourly !== null && (
                    <span className="shrink-0 font-semibold text-charcoal">
                      ≈{fmtMoney(t.effectiveHourly)}/hr
                    </span>
                  )}
                </div>
                <p className="ml-4 text-xs text-muted">
                  {fmtHours(t.hours)} · {fmtMoney(t.wages)} wages ·{" "}
                  {fmtMoney(t.tipShare)} tip share
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Housekeeping: unpaid + records */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card>
          <SectionLabel>Unpaid</SectionLabel>
          {aging.total > 0 ? (
            <>
              <p className="mt-1 font-display text-xl text-[#a04a4a]">
                {fmtMoney(aging.total)}
              </p>
              <p className="text-[10px] text-muted">
                {aging.count} shift{aging.count === 1 ? "" : "s"} · oldest{" "}
                {aging.oldestDate ? fmtDateLong(aging.oldestDate) : "—"}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#5a7d4f]">
              All caught up — nothing owed. ✓
            </p>
          )}
        </Card>
        <Card>
          <SectionLabel>Records</SectionLabel>
          {recs.bestTipDay ? (
            <div className="mt-1 text-xs text-muted">
              <p>
                Best day:{" "}
                <span className="font-semibold text-charcoal">
                  {fmtMoney(recs.bestTipDay.amount)}
                </span>{" "}
                ({fmtDateLong(recs.bestTipDay.date)})
              </p>
              {recs.bestTipWeek && (
                <p className="mt-0.5">
                  Best week:{" "}
                  <span className="font-semibold text-charcoal">
                    {fmtMoney(recs.bestTipWeek.tips)}
                  </span>{" "}
                  (wk of {fmtDateLong(recs.bestTipWeek.monday)})
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Log tips to start setting records.
            </p>
          )}
        </Card>
      </div>

      <p className="text-center text-[10px] leading-relaxed text-muted/70">
        All figures come straight from your logged shifts and tips.
        <br />
        Tip shares split each day&apos;s tips evenly among who worked that day.
      </p>
    </div>
  );
}
