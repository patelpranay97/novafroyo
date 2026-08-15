"use client";

import { useEffect, useState } from "react";
import {
  type DailySales,
  type Employee,
  type Settings,
  type Shift,
  type TipDay,
  fmtMoney,
  fmtHours,
  parseDateStr,
  toDateStr,
} from "@/lib/portal";
import {
  breakEven,
  earningsTotals,
  employeeStats,
  laborByDate,
  monthTotals,
  pctDelta,
  records,
  rentProgress,
  salesByWeekday,
  tipsByWeekday,
  unpaidAging,
  weeklyTrend,
} from "@/lib/insights";
import { Card, SectionLabel } from "./ui";
import { ColumnChart } from "./charts";

// Chart hues — validated (dataviz six checks) against the cream surface.
const HUE_TIPS = "#2d4f9e"; // aegean
const HUE_PAYROLL = "#b07d3f"; // honey
const HUE_SALES = "#2d4f9e"; // aegean
const HUE_PROFIT = "#5a7d4f"; // pistachio

type Props = {
  employees: Employee[];
  shifts: Shift[];
  tips: TipDay[];
  sales: DailySales[];
  settings: Settings;
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


function Tile({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta?: number | null;
  tone?: "good" | "bad";
}) {
  return (
    <Card className="text-center">
      <SectionLabel>{label}</SectionLabel>
      <p
        className={`mt-1 font-display text-xl ${
          tone === "bad" ? "text-[#a04a4a]" : tone === "good" ? "text-[#5a7d4f]" : ""
        }`}
      >
        {value}
      </p>
      {delta !== undefined && <Delta pct={delta} />}
    </Card>
  );
}

export function InsightsView({
  employees,
  shifts,
  tips,
  sales,
  settings,
}: Props) {
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
  // Last month is capped to the same day-of-month, or a month in progress
  // always reads as a collapse against a full one.
  const today = now.getDate();
  const thisMonth = monthTotals(shifts, tips, now.getFullYear(), now.getMonth());
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthTotals(
    shifts, tips, prev.getFullYear(), prev.getMonth(), today,
  );
  const weekdays = tipsByWeekday(shifts, tips);
  const weeks = weeklyTrend(shifts, tips, now);
  const team = employeeStats(employees, shifts, tips);
  const aging = unpaidAging(shifts);
  const recs = records(tips);

  // Earnings side — same daily_sales rows and same dayProfit() the Profit tab
  // uses, so these can never disagree with that page.
  const labor = laborByDate(shifts);
  const earn = earningsTotals(sales, settings, labor, now.getFullYear(), now.getMonth());
  const lastEarn = earningsTotals(
    sales, settings, labor, prev.getFullYear(), prev.getMonth(), today,
  );
  const rent = rentProgress(sales, settings, labor, now.getFullYear(), now.getMonth());
  const be = breakEven(sales, settings, labor);
  const salesWeekdays = salesByWeekday(sales, settings, labor);
  const salesWeekdayHasBars = salesWeekdays.some((w) => w.avgNet > 0);
  const bestSalesDay = sales.reduce<DailySales | null>(
    (best, s) =>
      best === null || Number(s.net_sales) > Number(best.net_sales) ? s : best,
    null,
  );

  const hasAnyData = shifts.length > 0 || tips.length > 0 || sales.length > 0;
  // Must match the chart's own render condition (max avgTips > 0), or the
  // card header promises a chart that never appears.
  const weekdayChartHasBars = weekdays.some((w) => w.avgTips > 0);

  if (!hasAnyData) {
    return (
      <Card className="py-12 text-center">
        <p className="text-sm text-muted">
          Log a few days of shifts, tips, and sales — your numbers show up here.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Earnings — this month vs last */}
      {earn.days > 0 && (
        <div>
          <SectionLabel>
            Earnings · {MONTH_NAMES[now.getMonth()]} 1–{today} · vs{" "}
            {MONTH_NAMES[prev.getMonth()].slice(0, 3)} 1–{today}
          </SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Tile
              label="Sales"
              value={fmtMoney(earn.net)}
              delta={pctDelta(earn.net, lastEarn.net)}
            />
            <Tile
              label="Profit"
              value={fmtMoney(earn.profit)}
              delta={pctDelta(earn.profit, lastEarn.profit)}
            />
            <Tile
              label="Take-home"
              value={fmtMoney(earn.takeHome)}
              tone={earn.takeHome < 0 ? "bad" : "good"}
            />
            {/* No delta here — a percent change of a percentage reads as
                percentage points and would mislead. */}
            <Tile
              label="Margin"
              value={earn.margin === null ? "—" : `${earn.margin}%`}
            />
          </div>
          <p className="mt-1.5 text-center text-[10px] leading-relaxed text-muted/80">
            {fmtMoney(earn.avgDay)}/day over {earn.days} day
            {earn.days === 1 ? "" : "s"}
            {earn.perCup !== null && <> · {fmtMoney(earn.perCup)} per cup</>}
            <br />
            Take-home is profit after the landlord&apos;s{" "}
            {Number(settings.landlord_pct)}% and {fmtMoney(rent.rent)} rent.
          </p>
        </div>
      )}

      {/* Rent progress + break-even */}
      {earn.days > 0 && (
        <Card>
          <SectionLabel>Covering {MONTH_NAMES[now.getMonth()]}</SectionLabel>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <p className="font-display text-xl">{fmtMoney(rent.earned)}</p>
            <p className="text-[10px] text-muted">
              toward {fmtMoney(rent.rent)} rent
            </p>
          </div>
          <div
            className="mt-2 h-1.5 w-full bg-charcoal/10"
            role="img"
            aria-label={`${Math.round(
              Math.min(100, Math.max(0, (rent.earned / rent.rent) * 100)),
            )}% of rent covered`}
          >
            <div
              className="h-full transition-[width]"
              style={{
                width: `${Math.min(100, Math.max(0, (rent.earned / rent.rent) * 100))}%`,
                background: rent.coveredOn ? HUE_PROFIT : HUE_PAYROLL,
              }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {rent.coveredOn ? (
              <>
                Rent was covered{" "}
                <span className="font-semibold text-charcoal">
                  {fmtDateLong(rent.coveredOn)}
                </span>{" "}
                — everything since is yours.
              </>
            ) : (
              <>
                <span className="font-semibold text-charcoal">
                  {fmtMoney(rent.remaining)}
                </span>{" "}
                to go before rent is covered.
              </>
            )}
          </p>
          {be && (
            <p className="mt-2 border-t border-charcoal/10 pt-2 text-[11px] leading-relaxed text-muted">
              Break-even is about{" "}
              <span className="font-semibold text-charcoal">
                {fmtMoney(be.dailyTarget)}/day
              </span>{" "}
              — you&apos;re averaging{" "}
              <span
                className={`font-semibold ${be.covered ? "text-[#5a7d4f]" : "text-[#a04a4a]"}`}
              >
                {fmtMoney(be.avgDaily)}
              </span>
              . That covers {fmtMoney(be.avgDailyLabor)} of wages a day, rent
              across ~{be.openDaysPerMonth} open days, and the{" "}
              {be.variableRatio}¢ of every dollar that goes to cups, card fees,
              and the landlord.
            </p>
          )}
        </Card>
      )}

      {/* Sales by weekday */}
      {salesWeekdayHasBars && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Sales by day of week</SectionLabel>
            <span className="flex items-center gap-3 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: HUE_SALES }}
                  aria-hidden="true"
                />
                Sales
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: HUE_PROFIT }}
                  aria-hidden="true"
                />
                Profit
              </span>
            </span>
          </div>
          <p className="mb-3 mt-1 text-[10px] text-muted/80">
            Which days actually earn — tap a bar for detail.
          </p>
          <ColumnChart
            ariaLabel="Average sales and profit for each day of the week"
            groups={salesWeekdays.map((w) => ({
              label: w.label,
              values: [w.avgNet, Math.max(0, w.avgProfit)],
            }))}
            colors={[HUE_SALES, HUE_PROFIT]}
            detail={(i) => {
              const w = salesWeekdays[i];
              if (w.daysCounted === 0) return `${w.label} · no sales logged yet`;
              return `${w.label} · avg ${fmtMoney(w.avgNet)} sales · ${fmtMoney(w.avgProfit)} profit · ${w.daysCounted} day${w.daysCounted === 1 ? "" : "s"}`;
            }}
          />
        </Card>
      )}

      {/* Labor KPI tiles — this month vs last */}
      <div>
        <SectionLabel>
          Labor &amp; tips · {MONTH_NAMES[now.getMonth()]} 1–{today} · vs{" "}
          {MONTH_NAMES[prev.getMonth()].slice(0, 3)} 1–{today}
        </SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Tile
            label="Tips"
            value={fmtMoney(thisMonth.tips)}
            delta={pctDelta(thisMonth.tips, lastMonth.tips)}
          />
          <Tile
            label="Payroll"
            value={fmtMoney(thisMonth.payroll)}
            delta={pctDelta(thisMonth.payroll, lastMonth.payroll)}
          />
          <Tile
            label="Hours"
            value={fmtHours(thisMonth.hours)}
            delta={pctDelta(thisMonth.hours, lastMonth.hours)}
          />
          <Tile
            label="Tips per hour"
            value={
              thisMonth.tipsPerHour === null
                ? "—"
                : fmtMoney(thisMonth.tipsPerHour)
            }
            delta={
              thisMonth.tipsPerHour !== null && lastMonth.tipsPerHour !== null
                ? pctDelta(thisMonth.tipsPerHour, lastMonth.tipsPerHour)
                : undefined
            }
          />
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
          {recs.bestTipDay || bestSalesDay ? (
            <div className="mt-1 text-xs text-muted">
              {recs.bestTipDay && (
                <p>
                  Best tip day:{" "}
                  <span className="font-semibold text-charcoal">
                    {fmtMoney(recs.bestTipDay.amount)}
                  </span>{" "}
                  ({fmtDateLong(recs.bestTipDay.date)})
                </p>
              )}
              {recs.bestTipWeek && (
                <p className="mt-0.5">
                  Best week:{" "}
                  <span className="font-semibold text-charcoal">
                    {fmtMoney(recs.bestTipWeek.tips)}
                  </span>{" "}
                  (wk of {fmtDateLong(recs.bestTipWeek.monday)})
                </p>
              )}
              {bestSalesDay && (
                <p className="mt-0.5">
                  Best sales day:{" "}
                  <span className="font-semibold text-charcoal">
                    {fmtMoney(Number(bestSalesDay.net_sales))}
                  </span>{" "}
                  ({fmtDateLong(bestSalesDay.work_date)})
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Log tips and sales to start setting records.
            </p>
          )}
        </Card>
      </div>

      <p className="text-center text-[10px] leading-relaxed text-muted/70">
        All figures come straight from your logged shifts, tips, and sales.
        <br />
        Tip shares split each day&apos;s tips evenly among who worked that day.
        <br />
        Profit and break-even use the same costs as the Profit tab — change them
        there.
      </p>
    </div>
  );
}
