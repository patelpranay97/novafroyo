// Pure, data-driven aggregations for the Insights tab.
// Everything here derives from shifts, tips, employees, and daily sales — no
// estimates, no modeling, just arithmetic over what was logged (the one
// exception being the projections at the bottom, which say so).

import {
  type DailySales,
  type Employee,
  type Settings,
  type Shift,
  type TipDay,
  dayProfit,
  parseDateStr,
  round2,
  shiftPay,
  splitProportional,
  startOfWeek,
  toDateStr,
  addDays,
} from "./portal";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-first weekday index (0 = Mon … 6 = Sun) for a YYYY-MM-DD string. */
export function weekdayIndex(dateStr: string): number {
  return (parseDateStr(dateStr).getDay() + 6) % 7;
}

// ---------- Month totals (KPI tiles) ----------

export type MonthTotals = {
  tips: number;
  payroll: number;
  hours: number;
  /** null when no hours logged that month */
  tipsPerHour: number | null;
};

function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * `throughDay` caps the month at that day-of-month. Comparing a month in
 * progress against a whole previous month reads as a huge decline when nothing
 * has actually changed, so the previous month gets capped to the same day.
 */
export function monthTotals(
  shifts: Shift[],
  tips: TipDay[],
  year: number,
  month: number,
  throughDay?: number,
): MonthTotals {
  const prefix = monthPrefix(year, month);
  const inRange = (d: string) =>
    d.startsWith(prefix) &&
    (throughDay === undefined || Number(d.slice(8, 10)) <= throughDay);
  const mShifts = shifts.filter((s) => inRange(s.work_date));
  const tipsSum = round2(
    tips.filter((t) => inRange(t.work_date)).reduce((a, t) => a + Number(t.amount), 0),
  );
  const hours = round2(mShifts.reduce((a, s) => a + Number(s.hours), 0));
  const payroll = round2(mShifts.reduce((a, s) => a + shiftPay(s), 0));
  return {
    tips: tipsSum,
    payroll,
    hours,
    tipsPerHour: hours > 0 ? round2(tipsSum / hours) : null,
  };
}

/** Percent change current vs previous; null when previous is 0/absent. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  const p = Math.round(((current - previous) / previous) * 100);
  return p === 0 ? 0 : p; // normalize -0 so tiny declines can't read as "up"
}

// ---------- Tips by weekday ----------

export type WeekdayStat = {
  weekday: number; // 0 = Mon
  label: string;
  /** average tips across days that have a tips entry; 0 when none */
  avgTips: number;
  daysCounted: number;
  /** tips ÷ labor hours on those same days; null when no hours logged */
  tipsPerLaborHour: number | null;
};

export function tipsByWeekday(shifts: Shift[], tips: TipDay[]): WeekdayStat[] {
  const hoursByDate = new Map<string, number>();
  for (const s of shifts) {
    hoursByDate.set(
      s.work_date,
      (hoursByDate.get(s.work_date) ?? 0) + Number(s.hours),
    );
  }
  const stats: WeekdayStat[] = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    avgTips: 0,
    daysCounted: 0,
    tipsPerLaborHour: null,
  }));
  const tipSum = new Array(7).fill(0);
  // The labor-hour ratio only counts tips from days that also have shifts
  // logged — otherwise tips from shiftless days inflate the $/labor-hr.
  const pairedTipSum = new Array(7).fill(0);
  const hourSum = new Array(7).fill(0);
  for (const t of tips) {
    const w = weekdayIndex(t.work_date);
    tipSum[w] += Number(t.amount);
    stats[w].daysCounted++;
    const hrs = hoursByDate.get(t.work_date) ?? 0;
    if (hrs > 0) {
      pairedTipSum[w] += Number(t.amount);
      hourSum[w] += hrs;
    }
  }
  for (const s of stats) {
    if (s.daysCounted > 0) {
      s.avgTips = round2(tipSum[s.weekday] / s.daysCounted);
      s.tipsPerLaborHour =
        hourSum[s.weekday] > 0
          ? round2(pairedTipSum[s.weekday] / hourSum[s.weekday])
          : null;
    }
  }
  return stats;
}

// ---------- Weekly trend ----------

export type WeekBucket = {
  monday: string; // YYYY-MM-DD
  label: string; // e.g. "7/13"
  tips: number;
  payroll: number;
  hours: number;
};

/** The last `count` payroll weeks ending with the week containing `now`. */
export function weeklyTrend(
  shifts: Shift[],
  tips: TipDay[],
  now: Date,
  count = 8,
): WeekBucket[] {
  const thisMonday = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const monday = addDays(thisMonday, -7 * i);
    const start = toDateStr(monday);
    const end = toDateStr(addDays(monday, 6));
    const wShifts = shifts.filter(
      (s) => s.work_date >= start && s.work_date <= end,
    );
    const wTips = tips.filter(
      (t) => t.work_date >= start && t.work_date <= end,
    );
    buckets.push({
      monday: start,
      label: `${monday.getMonth() + 1}/${monday.getDate()}`,
      tips: round2(wTips.reduce((a, t) => a + Number(t.amount), 0)),
      payroll: round2(wShifts.reduce((a, s) => a + shiftPay(s), 0)),
      hours: round2(wShifts.reduce((a, s) => a + Number(s.hours), 0)),
    });
  }
  // Drop leading empty weeks (before the shop had data) but keep the shape
  // once data starts so gaps in the middle stay visible and honest.
  const firstWithData = buckets.findIndex((b) => b.tips > 0 || b.hours > 0);
  return firstWithData <= 0 ? buckets : buckets.slice(firstWithData);
}

// ---------- Per-employee lifetime stats ----------

export type EmployeeStats = {
  empId: string;
  name: string;
  color: string;
  active: boolean;
  hours: number;
  wages: number;
  tipShare: number;
  /** (wages + tipShare) / hours; null when no hours */
  effectiveHourly: number | null;
};

export function employeeStats(
  employees: Employee[],
  shifts: Shift[],
  tips: TipDay[],
): EmployeeStats[] {
  // Even per-day tip split among whoever worked that day (same rule as the
  // week view's wage check).
  const workersByDate = new Map<string, Set<string>>();
  for (const s of shifts) {
    const set = workersByDate.get(s.work_date) ?? new Set<string>();
    set.add(s.employee_id);
    workersByDate.set(s.work_date, set);
  }
  const tipShare = new Map<string, number>();
  for (const t of tips) {
    const workers = workersByDate.get(t.work_date);
    if (!workers || workers.size === 0) continue;
    // Cent-exact even split so lifetime shares never sum past tips collected.
    const ids = [...workers];
    const shares = splitProportional(Number(t.amount), ids.map(() => 1));
    ids.forEach((id, i) =>
      tipShare.set(id, (tipShare.get(id) ?? 0) + shares[i]),
    );
  }
  return employees
    .map((e) => {
      const own = shifts.filter((s) => s.employee_id === e.id);
      const hours = round2(own.reduce((a, s) => a + Number(s.hours), 0));
      const wages = round2(own.reduce((a, s) => a + shiftPay(s), 0));
      const share = round2(tipShare.get(e.id) ?? 0);
      return {
        empId: e.id,
        name: e.name,
        color: e.color,
        active: e.active,
        hours,
        wages,
        tipShare: share,
        effectiveHourly: hours > 0 ? round2((wages + share) / hours) : null,
      };
    })
    .filter((e) => e.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

// ---------- Income projections ----------
// Pure day-of-week averaging over the trailing 28 days of entries (all
// entries if the shop is younger than that). No modeling, no AI: big
// Saturdays project as big Saturdays because past Saturdays were big.

export type IncomeEntry = {
  work_date: string; // YYYY-MM-DD
  net: number; // net sales (revenue, excl. sales tax)
  profit: number; // netish profit for the day
};

export type IncomeProjection = {
  sampleDays: number;
  monthGross: number; // actuals so far + weekday-average estimates for the rest
  monthNet: number;
  monthActualGross: number;
  monthActualNet: number;
  monthDaysProjected: number;
  ninetyGross: number; // next 90 days, pure forward estimate
  ninetyNet: number;
  zeroWeekdays: string[]; // weekday labels with no data (project $0)
};

export function projectIncome(
  entries: IncomeEntry[],
  today: Date,
): IncomeProjection {
  const todayStr = toDateStr(today);
  const cutoff = toDateStr(addDays(today, -28));
  let window = entries.filter(
    (e) => e.work_date >= cutoff && e.work_date <= todayStr,
  );
  if (window.length === 0) window = entries;

  const wdNet = new Array(7).fill(0);
  const wdProfit = new Array(7).fill(0);
  const wdCount = new Array(7).fill(0);
  for (const e of window) {
    const w = weekdayIndex(e.work_date);
    wdNet[w] += Number(e.net);
    wdProfit[w] += Number(e.profit);
    wdCount[w]++;
  }
  const avgNet = (w: number) => (wdCount[w] ? wdNet[w] / wdCount[w] : 0);
  const avgProfit = (w: number) => (wdCount[w] ? wdProfit[w] / wdCount[w] : 0);

  const byDate = new Map(entries.map((e) => [e.work_date, e]));
  const y = today.getFullYear();
  const m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  let monthGross = 0;
  let monthNet = 0;
  let monthActualGross = 0;
  let monthActualNet = 0;
  let monthDaysProjected = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(new Date(y, m, d));
    const e = byDate.get(ds);
    if (e) {
      monthGross += Number(e.net);
      monthNet += Number(e.profit);
      monthActualGross += Number(e.net);
      monthActualNet += Number(e.profit);
    } else if (ds >= todayStr) {
      // Today (no entry yet) and future days get the weekday estimate;
      // past days with no entry count as closed ($0).
      const w = weekdayIndex(ds);
      monthGross += avgNet(w);
      monthNet += avgProfit(w);
      monthDaysProjected++;
    }
  }

  let ninetyGross = 0;
  let ninetyNet = 0;
  for (let i = 0; i < 90; i++) {
    const w = (addDays(today, i).getDay() + 6) % 7;
    ninetyGross += avgNet(w);
    ninetyNet += avgProfit(w);
  }

  return {
    sampleDays: window.length,
    monthGross: round2(monthGross),
    monthNet: round2(monthNet),
    monthActualGross: round2(monthActualGross),
    monthActualNet: round2(monthActualNet),
    monthDaysProjected,
    ninetyGross: round2(ninetyGross),
    ninetyNet: round2(ninetyNet),
    zeroWeekdays: WEEKDAY_LABELS.filter((_, i) => wdCount[i] === 0),
  };
}

// ---------- Monte Carlo income simulation ----------
// Bootstrap: for each future day, draw a real past day of the same weekday,
// at random, with replacement. Repeat a few thousand times to see the spread
// of plausible totals. Deterministically seeded from the data, so the same
// entries always produce the same range (a projection that changed on every
// refresh would be worthless).

export type IncomeRange = {
  low: number; // 10th percentile
  mid: number; // median
  high: number; // 90th percentile
};

export type IncomeSimulation = {
  monthGross: IncomeRange;
  monthNet: IncomeRange;
  ninetyGross: IncomeRange;
  ninetyNet: IncomeRange;
  trials: number;
  /** Weekdays with fewer than 2 samples can't show real spread. */
  thinWeekdays: string[];
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic PRNG. */
function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((p / 100) * (sorted.length - 1))),
  );
  return round2(sorted[idx]);
}

export function simulateIncome(
  entries: IncomeEntry[],
  today: Date,
  trials = 2000,
): IncomeSimulation {
  const todayStr = toDateStr(today);
  const cutoff = toDateStr(addDays(today, -28));
  let window = entries.filter(
    (e) => e.work_date >= cutoff && e.work_date <= todayStr,
  );
  if (window.length === 0) window = entries;

  // Observed days grouped by weekday.
  const byWeekday: { net: number; profit: number }[][] = Array.from(
    { length: 7 },
    () => [],
  );
  for (const e of window) {
    byWeekday[weekdayIndex(e.work_date)].push({
      net: Number(e.net),
      profit: Number(e.profit),
    });
  }

  // Days still to come this month, and the next 90 days.
  const byDate = new Map(entries.map((e) => [e.work_date, e]));
  const y = today.getFullYear();
  const m = today.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthFuture: number[] = [];
  let monthActualGross = 0;
  let monthActualNet = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(new Date(y, m, d));
    const e = byDate.get(ds);
    if (e) {
      monthActualGross += Number(e.net);
      monthActualNet += Number(e.profit);
    } else if (ds >= todayStr) {
      monthFuture.push(weekdayIndex(ds));
    }
  }
  const ninetyDays: number[] = [];
  for (let i = 0; i < 90; i++) {
    ninetyDays.push((addDays(today, i).getDay() + 6) % 7);
  }

  const seed = hashSeed(
    window.map((e) => `${e.work_date}:${e.net}:${e.profit}`).join("|"),
  );
  const rng = makeRng(seed || 1);

  const mg: number[] = [];
  const mn: number[] = [];
  const ng: number[] = [];
  const nn: number[] = [];
  for (let t = 0; t < trials; t++) {
    let mGross = monthActualGross;
    let mNet = monthActualNet;
    for (const w of monthFuture) {
      const obs = byWeekday[w];
      if (obs.length === 0) continue; // no data for that weekday -> $0
      const pick = obs[Math.floor(rng() * obs.length)];
      mGross += pick.net;
      mNet += pick.profit;
    }
    let nGross = 0;
    let nNet = 0;
    for (const w of ninetyDays) {
      const obs = byWeekday[w];
      if (obs.length === 0) continue;
      const pick = obs[Math.floor(rng() * obs.length)];
      nGross += pick.net;
      nNet += pick.profit;
    }
    mg.push(mGross);
    mn.push(mNet);
    ng.push(nGross);
    nn.push(nNet);
  }
  for (const arr of [mg, mn, ng, nn]) arr.sort((a, b) => a - b);
  const range = (arr: number[]): IncomeRange => ({
    low: percentile(arr, 10),
    mid: percentile(arr, 50),
    high: percentile(arr, 90),
  });

  return {
    monthGross: range(mg),
    monthNet: range(mn),
    ninetyGross: range(ng),
    ninetyNet: range(nn),
    trials,
    thinWeekdays: WEEKDAY_LABELS.filter(
      (_, i) => byWeekday[i].length === 1,
    ),
  };
}

// ---------- Earnings (sales-driven) ----------
//
// Everything below reads the same daily_sales rows the Profit tab uses, run
// through the same dayProfit() — so a number here can never disagree with the
// number there.

/** Wages logged per date, keyed YYYY-MM-DD. */
export function laborByDate(shifts: Shift[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of shifts) {
    m.set(s.work_date, round2((m.get(s.work_date) ?? 0) + shiftPay(s)));
  }
  return m;
}

export type EarningsTotals = {
  net: number;
  profit: number;
  /** after the landlord's cut and the month's rent */
  takeHome: number;
  landlord: number;
  days: number;
  /** average net sales per day the shop was open */
  avgDay: number;
  /** profit as a share of net sales; null when nothing sold */
  margin: number | null;
  cups: number;
  /** net sales ÷ cups sold; null when no cups logged */
  perCup: number | null;
};

/** `throughDay` caps the month at that day-of-month — see monthTotals(). */
export function earningsTotals(
  sales: DailySales[],
  settings: Settings,
  labor: Map<string, number>,
  year: number,
  month: number,
  throughDay?: number,
): EarningsTotals {
  const prefix = monthPrefix(year, month);
  const rows = sales.filter(
    (s) =>
      s.work_date.startsWith(prefix) &&
      (throughDay === undefined || Number(s.work_date.slice(8, 10)) <= throughDay),
  );
  let net = 0, profit = 0, landlord = 0, cups = 0;
  for (const s of rows) {
    const p = dayProfit(s, settings, labor.get(s.work_date) ?? 0);
    net += Number(s.net_sales);
    profit += p.profit;
    landlord += p.landlordShare;
    cups += s.mini_cups + s.regular_cups + s.super_cups;
  }
  net = round2(net);
  profit = round2(profit);
  landlord = round2(landlord);
  return {
    net,
    profit,
    landlord,
    takeHome: round2(profit - landlord - Number(settings.monthly_rent)),
    days: rows.length,
    avgDay: rows.length > 0 ? round2(net / rows.length) : 0,
    margin: net > 0 ? round2((profit / net) * 100) : null,
    cups,
    perCup: cups > 0 ? round2(net / cups) : null,
  };
}

export type SalesWeekdayStat = {
  weekday: number; // 0 = Mon
  label: string;
  avgNet: number;
  avgProfit: number;
  daysCounted: number;
};

/** Average sales and profit for each day of the week. */
export function salesByWeekday(
  sales: DailySales[],
  settings: Settings,
  labor: Map<string, number>,
): SalesWeekdayStat[] {
  const netSum = new Array(7).fill(0);
  const profitSum = new Array(7).fill(0);
  const counts = new Array(7).fill(0);
  for (const s of sales) {
    const w = weekdayIndex(s.work_date);
    netSum[w] += Number(s.net_sales);
    profitSum[w] += dayProfit(s, settings, labor.get(s.work_date) ?? 0).profit;
    counts[w]++;
  }
  return WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    daysCounted: counts[weekday],
    avgNet: counts[weekday] > 0 ? round2(netSum[weekday] / counts[weekday]) : 0,
    avgProfit:
      counts[weekday] > 0 ? round2(profitSum[weekday] / counts[weekday]) : 0,
  }));
}

export type BreakEven = {
  /** net sales needed on an average open day to clear every cost */
  dailyTarget: number;
  /** what you're actually averaging */
  avgDaily: number;
  /** open days per month implied by your observed cadence */
  openDaysPerMonth: number;
  /** cups cost + card fees + landlord, as a share of each sales dollar */
  variableRatio: number;
  avgDailyLabor: number;
  covered: boolean;
};

/**
 * The daily sales number that covers variable costs, wages, and rent.
 *
 * Variable costs scale with sales, so they're taken as a ratio; wages and rent
 * don't, so they're the fixed side. Needs a real span of history (a week and
 * at least 5 logged days) or it returns null rather than guessing.
 */
export function breakEven(
  sales: DailySales[],
  settings: Settings,
  labor: Map<string, number>,
): BreakEven | null {
  if (sales.length < 5) return null;
  const dates = sales.map((s) => s.work_date).sort();
  const spanDays =
    Math.round(
      (parseDateStr(dates[dates.length - 1]).getTime() -
        parseDateStr(dates[0]).getTime()) /
        86_400_000,
    ) + 1;
  if (spanDays < 7) return null;

  let net = 0, variable = 0, laborSum = 0;
  for (const s of sales) {
    const p = dayProfit(s, settings, labor.get(s.work_date) ?? 0);
    net += Number(s.net_sales);
    variable += p.cogs + Number(s.fees) + p.landlordShare;
    laborSum += p.labor;
  }
  if (net <= 0) return null;
  const variableRatio = variable / net;
  // A margin at or below zero has no break-even point — more sales lose more.
  if (variableRatio >= 1) return null;

  const openDaysPerMonth = Math.min(
    30.44,
    round2((sales.length / spanDays) * 30.44),
  );
  if (openDaysPerMonth <= 0) return null;
  const avgDailyLabor = round2(laborSum / sales.length);
  const fixedPerDay =
    avgDailyLabor + Number(settings.monthly_rent) / openDaysPerMonth;
  const avgDaily = round2(net / sales.length);
  return {
    dailyTarget: round2(fixedPerDay / (1 - variableRatio)),
    avgDaily,
    openDaysPerMonth: Math.round(openDaysPerMonth),
    variableRatio: round2(variableRatio * 100),
    avgDailyLabor,
    covered: avgDaily >= round2(fixedPerDay / (1 - variableRatio)),
  };
}

export type RentProgress = {
  rent: number;
  /** month-to-date profit after the landlord's cut */
  earned: number;
  /** the day the month's rent was fully covered, if it has been */
  coveredOn: string | null;
  remaining: number;
};

/** How far into the month you are toward covering rent. */
export function rentProgress(
  sales: DailySales[],
  settings: Settings,
  labor: Map<string, number>,
  year: number,
  month: number,
): RentProgress {
  const prefix = monthPrefix(year, month);
  const rows = sales
    .filter((s) => s.work_date.startsWith(prefix))
    .sort((a, b) => a.work_date.localeCompare(b.work_date));
  const rent = Number(settings.monthly_rent);
  let running = 0;
  let coveredOn: string | null = null;
  for (const s of rows) {
    const p = dayProfit(s, settings, labor.get(s.work_date) ?? 0);
    running += p.afterLandlord;
    if (coveredOn === null && running >= rent) coveredOn = s.work_date;
  }
  const earned = round2(running);
  return {
    rent,
    earned,
    coveredOn,
    remaining: round2(Math.max(0, rent - earned)),
  };
}

// ---------- Unpaid aging + records ----------

export type UnpaidAging = {
  total: number;
  count: number;
  oldestDate: string | null;
};

export function unpaidAging(shifts: Shift[]): UnpaidAging {
  const unpaid = shifts.filter((s) => !s.paid_at);
  const total = round2(unpaid.reduce((a, s) => a + shiftPay(s), 0));
  const oldestDate = unpaid.reduce<string | null>(
    (oldest, s) => (oldest === null || s.work_date < oldest ? s.work_date : oldest),
    null,
  );
  return { total, count: unpaid.length, oldestDate };
}

export type Records = {
  bestTipDay: { date: string; amount: number } | null;
  bestTipWeek: { monday: string; tips: number } | null;
};

export function records(tips: TipDay[]): Records {
  let bestTipDay: Records["bestTipDay"] = null;
  const weekTotals = new Map<string, number>();
  for (const t of tips) {
    const amount = Number(t.amount);
    if (!bestTipDay || amount > bestTipDay.amount) {
      bestTipDay = { date: t.work_date, amount };
    }
    const monday = toDateStr(startOfWeek(parseDateStr(t.work_date)));
    weekTotals.set(monday, (weekTotals.get(monday) ?? 0) + amount);
  }
  let bestTipWeek: Records["bestTipWeek"] = null;
  for (const [monday, total] of weekTotals) {
    if (!bestTipWeek || total > bestTipWeek.tips) {
      bestTipWeek = { monday, tips: round2(total) };
    }
  }
  return { bestTipDay, bestTipWeek };
}
