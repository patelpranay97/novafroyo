// Pure, data-driven aggregations for the Insights tab.
// Everything here derives from shifts + tips + employees — no estimates,
// no modeling, just arithmetic over what was logged.

import {
  type Employee,
  type Shift,
  type TipDay,
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

export function monthTotals(
  shifts: Shift[],
  tips: TipDay[],
  year: number,
  month: number,
): MonthTotals {
  const prefix = monthPrefix(year, month);
  const mShifts = shifts.filter((s) => s.work_date.startsWith(prefix));
  const tipsSum = round2(
    tips
      .filter((t) => t.work_date.startsWith(prefix))
      .reduce((a, t) => a + Number(t.amount), 0),
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
