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
  landlordPctFor,
  round2,
  parseDateStr,
  toDateStr,
} from "@/lib/portal";
import {
  breakEven,
  earningsTotals,
  employeeStats,
  mixComparison,
  tempSplits,
  weatherCoverage,
  weatherSplits,
  laborByDate,
  landlordTotals,
  monthTotals,
  monthlyRevenue,
  pctDelta,
  records,
  rentProgress,
  salesByWeekday,
  tipsByWeekday,
  type DaySplit,
  unpaidAging,
  weeklyTrend,
  yearTotals,
} from "@/lib/insights";
import { Card, SectionLabel } from "./ui";
import { ColumnChart, LineChart } from "./charts";

// Chart hues — validated (dataviz six checks) against the cream surface.
const HUE_TIPS = "#2d4f9e"; // aegean
const HUE_PAYROLL = "#b07d3f"; // honey
const HUE_SALES = "#2d4f9e"; // aegean
const HUE_PROFIT = "#5a7d4f"; // pistachio
const HUE_COPACKER = "#8a5a2b"; // caramel — matches the calendar's co-packer dot

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

/**
 * Name every landlord rate a window actually billed at. A month — or a year —
 * can straddle a rate change, so asserting today's rate applied throughout
 * would misstate what was paid.
 */
function rateLabel(dates: string[], settings: Settings): string {
  const rates = [...new Set(dates.map((d) => landlordPctFor(d, settings)))].sort(
    (a, b) => a - b,
  );
  if (rates.length === 0) return `${Number(settings.landlord_pct)}%`;
  if (rates.length === 1) return `${rates[0]}%`;
  return `${rates[0]}–${rates[rates.length - 1]}%`;
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


/** One line of detail behind a weather/temperature bar. */
function splitDetail(d: DaySplit): string {
  return `${d.label} · avg ${fmtMoney(d.avgNet)} sales · ${fmtMoney(d.avgProfit)} profit · ${d.days} day${d.days === 1 ? "" : "s"}`;
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
  const months = monthlyRevenue(sales, settings, labor, now);
  const toLandlord = landlordTotals(
    sales, settings, labor, now.getFullYear(), now.getMonth(),
  );
  const ytd = yearTotals(sales, settings, labor, now.getFullYear());
  const monthDates = sales
    .map((s) => s.work_date)
    .filter((d) => d.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`));
  const monthRate = rateLabel(monthDates, settings);
  const ytdRate = rateLabel(
    sales.map((s) => s.work_date).filter((d) => d.startsWith(`${now.getFullYear()}-`)),
    settings,
  );
  const mix = mixComparison(sales, settings, labor);
  const weather = weatherSplits(sales, settings, labor);
  const temps = tempSplits(sales, settings, labor);
  const wxCoverage = weatherCoverage(sales);
  /**
   * The question the mix card exists to answer: making it in-house costs prep
   * wages, the co-packer costs more per ounce. Comparing the daily mix premium
   * against the wage difference says which is actually cheaper — stated as an
   * observation, since a quiet week could explain the wage gap just as well.
   */
  const mixVerdict = (() => {
    if (!mix || mix.copacker.days === 0) return null;
    const premium = Math.round((mix.extraMixCost / mix.copacker.days) * 100) / 100;
    const laborGap = Math.round((mix.own.avgLabor - mix.copacker.avgLabor) * 100) / 100;
    const net = Math.round((premium - laborGap) * 100) / 100;
    const thin = mix.copacker.days < 5 || mix.own.days < 5;
    if (Math.abs(laborGap) < 1) {
      return (
        <>
          Wages ran about the same either way, so the co-packer is a straight{" "}
          <span className="font-semibold text-charcoal">
            {fmtMoney(premium)}/day
          </span>{" "}
          cost with nothing offsetting it.
        </>
      );
    }
    return (
      <>
        Co-packer days also ran{" "}
        <span className="font-semibold text-charcoal">
          {fmtMoney(Math.abs(laborGap))}/day
        </span>{" "}
        {laborGap > 0 ? "less" : "more"} in wages. If that gap is prep you skip,
        the {fmtMoney(premium)}/day mix premium nets out to{" "}
        <span
          className={`font-semibold ${net > 0 ? "text-[#a04a4a]" : "text-[#5a7d4f]"}`}
        >
          {net > 0 ? `${fmtMoney(net)}/day worse` : `${fmtMoney(-net)}/day better`}
        </span>
        .{" "}
        {thin
          ? "Too few days either way to lean on yet — a quiet week would move this as much as the mix does."
          : "Worth checking against a slow week before acting on it."}
      </>
    );
  })();

  // A single day is an anecdote; say so rather than drawing a confident bar.
  const thinSplits = [...weather, ...temps]
    .filter((d) => d.days === 1)
    .map((d) => d.label);
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
            Take-home is profit after the landlord&apos;s {monthRate} and{" "}
            {fmtMoney(rent.rent)} rent.
          </p>
        </div>
      )}

      {/* Year to date */}
      {ytd.days > 0 && (
        <div>
          <SectionLabel>Year to date · {now.getFullYear()}</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Tile label="Revenue" value={fmtMoney(ytd.net)} />
            <Tile label="Profit" value={fmtMoney(ytd.profit)} />
            <Tile
              label="Take-home"
              value={fmtMoney(ytd.takeHome)}
              tone={ytd.takeHome < 0 ? "bad" : "good"}
            />
            <Tile
              label="Margin"
              value={ytd.margin === null ? "—" : `${ytd.margin}%`}
            />
          </div>
          <p className="mt-1.5 text-center text-[10px] leading-relaxed text-muted/80">
            {ytd.days} day{ytd.days === 1 ? "" : "s"} open across {ytd.months}{" "}
            month{ytd.months === 1 ? "" : "s"} · {fmtMoney(ytd.avgDay)}/day
            {ytd.perCup !== null && <> · {fmtMoney(ytd.perCup)} per cup</>}
            <br />
            Take-home is profit less {fmtMoney(ytd.landlord)} of revenue share
            ({ytdRate}) and {fmtMoney(ytd.rent)} rent ({ytd.months} ×{" "}
            {fmtMoney(Number(settings.monthly_rent))}).
          </p>
        </div>
      )}

      {/* Month over month */}
      {months.length > 1 && (
        <Card>
          <SectionLabel>Revenue, month over month</SectionLabel>
          <p className="mb-3 mt-1 text-[10px] text-muted/80">
            Net sales per month — tap a point for detail.
            {months[months.length - 1].partial && (
              <>
                {" "}
                {months[months.length - 1].label} is still in progress, so its
                point will keep rising.
              </>
            )}
          </p>
          <LineChart
            ariaLabel="Net sales for each month"
            color={HUE_SALES}
            points={months.map((m) => ({
              label: m.label,
              value: m.net,
              muted: m.partial,
            }))}
            detail={(i) => {
              const m = months[i];
              if (m.days === 0) return `${m.label} · nothing logged`;
              const prev = months[i - 1];
              const delta =
                prev && prev.net > 0 ? pctDelta(m.net, prev.net) : null;
              return (
                `${m.label} · ${fmtMoney(m.net)} sales · ${fmtMoney(m.profit)} profit · ` +
                `${m.days} day${m.days === 1 ? "" : "s"}` +
                (delta !== null
                  ? ` · ${delta >= 0 ? "+" : ""}${delta}% vs ${prev.label}`
                  : "") +
                (m.partial ? " · still in progress" : "")
              );
            }}
          />
        </Card>
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

      {/* Paid to landlord */}
      {toLandlord.allTotal > 0 && (
        <Card>
          <SectionLabel>Paid to landlord</SectionLabel>
          <p className="mb-3 mt-1 text-[10px] text-muted/80">
            They&apos;re paid twice — a share of revenue, and the rent.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
                <th className="pb-1 text-left font-semibold" />
                <th className="pb-1 text-right font-semibold">
                  {MONTH_NAMES[now.getMonth()].slice(0, 3)}
                </th>
                <th className="pb-1 text-right font-semibold">
                  {now.getFullYear()} YTD
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-charcoal/10">
                <td className="py-1.5 text-left text-muted">
                  Revenue share
                </td>
                <td className="py-1.5 text-right">
                  {fmtMoney(toLandlord.monthShare)}
                </td>
                <td className="py-1.5 text-right font-semibold text-[#8a5a2b]">
                  {fmtMoney(toLandlord.ytdShare)}
                </td>
              </tr>
              <tr className="border-t border-charcoal/10">
                <td className="py-1.5 text-left text-muted">Rent</td>
                <td className="py-1.5 text-right">
                  {fmtMoney(toLandlord.monthRent)}
                </td>
                <td className="py-1.5 text-right">
                  {fmtMoney(toLandlord.ytdRent)}
                </td>
              </tr>
              <tr className="border-t border-charcoal/20">
                <td className="py-1.5 text-left font-semibold">Total</td>
                <td className="py-1.5 text-right font-semibold">
                  {fmtMoney(toLandlord.monthTotal)}
                </td>
                <td className="py-1.5 text-right font-display text-base">
                  {fmtMoney(toLandlord.ytdTotal)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
            Revenue share is exact — every day is counted at the rate it was
            billed. Rent is today&apos;s {fmtMoney(Number(settings.monthly_rent))}{" "}
            across the {toLandlord.ytdMonths} month
            {toLandlord.ytdMonths === 1 ? "" : "s"}{" "}
            with sales this year, so it assumes rent hasn&apos;t changed.
            {toLandlord.allTotal !== toLandlord.ytdTotal && (
              <>
                {" "}
                All time: {fmtMoney(toLandlord.allTotal)} (
                {fmtMoney(toLandlord.allShare)} share).
              </>
            )}
          </p>
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

      {/* Our mix vs the co-packer's */}
      {mix && (
        <Card>
          <SectionLabel>Our mix vs the co-packer&apos;s</SectionLabel>
          <p className="mb-3 mt-1 text-[10px] text-muted/80">
            Same shop, same menu — only the mix changed.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[mix.own, mix.copacker].map((d, i) => (
              <div
                key={d.key}
                className="border border-charcoal/15 px-3 py-2 text-center"
              >
                <p className="flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
                  {i === 1 && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: HUE_COPACKER }}
                      aria-hidden="true"
                    />
                  )}
                  {d.label}
                </p>
                <p
                  className="mt-1 font-display text-lg"
                  style={{ color: i === 1 ? HUE_COPACKER : HUE_PROFIT }}
                >
                  {fmtMoney(d.avgProfit)}
                </p>
                <p className="text-[10px] text-muted">profit/day</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted/80">
                  {d.days} day{d.days === 1 ? "" : "s"}
                  {d.margin !== null && <> · {d.margin}% margin</>}
                  <br />
                  {fmtMoney(d.avgLabor)} wages/day
                  {d.cogsPerCup !== null && (
                    <> · {fmtMoney(d.cogsPerCup)}/cup</>
                  )}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            The co-packer&apos;s mix has cost{" "}
            <span className="font-semibold text-charcoal">
              {fmtMoney(mix.extraMixCost)}
            </span>{" "}
            extra across {mix.copacker.days} day
            {mix.copacker.days === 1 ? "" : "s"} — about{" "}
            {fmtMoney(round2(mix.extraMixCost / Math.max(1, mix.copacker.days)))} a
            day at {fmtMoney(Number(settings.mix_copacker_cost))}/oz against{" "}
            {fmtMoney(Number(settings.mix_own_cost))}/oz for ours.
            {mixVerdict && (
              <>
                <br />
                <br />
                {mixVerdict}
              </>
            )}
            {mix.own.avgNet > 0 && mix.copacker.avgNet > 0 && (
              <>
                {" "}
                Sales ran {fmtMoney(mix.copacker.avgNet)}/day on co-packer days
                vs {fmtMoney(mix.own.avgNet)} on ours
                {Math.abs(mix.copacker.avgNet - mix.own.avgNet) /
                  mix.own.avgNet <
                0.05
                  ? " — close enough to call the difference in profit a cost story, not a sales one."
                  : ", so the profit gap is part cost and part traffic."}
              </>
            )}
          </p>
        </Card>
      )}

      {/* Weather */}
      {(weather.length > 0 || temps.length > 0) && (
        <Card>
          <SectionLabel>How weather moves sales</SectionLabel>
          <p className="mb-3 mt-1 text-[10px] text-muted/80">
            Average sales per day — tap a bar for detail.
            {wxCoverage.logged < wxCoverage.total && (
              <>
                {" "}
                Logged on {wxCoverage.logged} of {wxCoverage.total} days.
              </>
            )}
          </p>
          {weather.length > 0 && (
            <ColumnChart
              ariaLabel="Average sales for each weather condition"
              groups={weather.map((w) => ({ label: w.label, values: [w.avgNet] }))}
              colors={[HUE_SALES]}
              detail={(i) => splitDetail(weather[i])}
            />
          )}
          {temps.length > 0 && (
            <div className={weather.length > 0 ? "mt-4" : ""}>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
                By temperature
              </p>
              <ColumnChart
                ariaLabel="Average sales for each temperature band"
                groups={temps.map((t) => ({ label: t.label, values: [t.avgNet] }))}
                colors={[HUE_SALES]}
                detail={(i) => splitDetail(temps[i])}
              />
            </div>
          )}
          {thinSplits.length > 0 && (
            <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
              {thinSplits.join(", ")} {thinSplits.length === 1 ? "has" : "have"}{" "}
              only one day logged — not enough to read a pattern into yet.
            </p>
          )}
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
