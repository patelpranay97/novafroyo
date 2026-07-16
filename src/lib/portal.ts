// Shared types + date/money helpers for the portal.
// All dates are handled as local "YYYY-MM-DD" strings. Never construct a Date
// from one of these strings directly (new Date("2026-07-15") parses as UTC and
// shifts a day in Chicago) — use parseDateStr instead.

export type Employee = {
  id: string;
  name: string;
  hourly_rate: number;
  color: string;
  active: boolean;
  created_at: string;
};

export type Shift = {
  id: string;
  employee_id: string;
  work_date: string; // YYYY-MM-DD
  hours: number;
  rate: number;
  note: string | null;
  paid_at: string | null;
  created_at: string;
};

export type TipDay = {
  work_date: string; // YYYY-MM-DD
  amount: number;
  note: string | null;
  updated_at: string;
};

export const EMPLOYEE_COLORS = [
  "#2d4f9e", // aegean
  "#8a5a2b", // caramel
  "#5a7d4f", // pistachio
  "#a04a4a", // strawberry
  "#6d5a8a", // ube
  "#3f7d7d", // teal
  "#b07d3f", // honey
  "#7d3f5f", // berry
];

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Monday of the week containing d (payroll weeks run Mon–Sun). */
export function startOfWeek(d: Date): Date {
  const sinceMonday = (d.getDay() + 6) % 7;
  return addDays(d, -sinceMonday);
}

export function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(monday, i)));
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function fmtDayShort(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${DAYS_SHORT[(d.getDay() + 6) % 7]} ${d.getMonth() + 1}/${d.getDate()}`;
}

export function fmtWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const m1 = MONTHS[monday.getMonth()].slice(0, 3);
  const m2 = MONTHS[sunday.getMonth()].slice(0, 3);
  const y1 = monday.getFullYear();
  const y2 = sunday.getFullYear();
  // A payroll week that straddles New Year's must show both years, or the
  // December work gets filed under January's year.
  if (y1 !== y2) {
    return `${m1} ${monday.getDate()}, ${y1} – ${m2} ${sunday.getDate()}, ${y2}`;
  }
  const range =
    monday.getMonth() === sunday.getMonth()
      ? `${m1} ${monday.getDate()}–${sunday.getDate()}`
      : `${m1} ${monday.getDate()} – ${m2} ${sunday.getDate()}`;
  return `${range}, ${y2}`;
}

export function fmtMonthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** Cents-safe: round each shift's pay to the cent before summing. */
export function shiftPay(s: Shift): number {
  return Math.round(Number(s.hours) * Number(s.rate) * 100) / 100;
}

export function sumPay(shifts: Shift[]): number {
  return round2(shifts.reduce((t, s) => t + shiftPay(s), 0));
}

export function sumHours(shifts: Shift[]): number {
  return round2(shifts.reduce((t, s) => t + Number(s.hours), 0));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Split `pot` across `weights` so the shares sum EXACTLY to `pot` to the cent
 * (largest-remainder allocation). Prevents paying out a cent or two more/less
 * than was actually collected.
 */
export function splitProportional(pot: number, weights: number[]): number[] {
  const totalW = weights.reduce((a, b) => a + b, 0);
  const potCents = Math.round(pot * 100);
  if (totalW <= 0 || potCents <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (potCents * w) / totalW);
  const cents = exact.map((c) => Math.floor(c));
  let leftover = potCents - cents.reduce((a, b) => a + b, 0);
  const byFrac = exact
    .map((c, i) => ({ i, frac: c - Math.floor(c) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; leftover > 0 && k < byFrac.length; k++, leftover--) {
    cents[byFrac[k].i]++;
  }
  return cents.map((c) => c / 100);
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "5" -> "5h", "5.5" -> "5.5h" */
export function fmtHours(n: number): string {
  return `${Number(n.toFixed(2))}h`;
}

/**
 * Daily-basis by-hours tip split: each day's tips are divided among that
 * day's workers proportional to their hours (cent-exact), then summed per
 * employee. Tips on days with no shifts can't be attributed and are
 * returned as `unallocated`.
 */
export function dailyHourTipShares(
  shifts: Shift[],
  tips: TipDay[],
): { shares: Map<string, number>; unallocated: number } {
  const byDate = new Map<string, Shift[]>();
  for (const s of shifts) {
    const arr = byDate.get(s.work_date) ?? [];
    arr.push(s);
    byDate.set(s.work_date, arr);
  }
  const shares = new Map<string, number>();
  let unallocatedCents = 0;
  for (const t of tips) {
    const amount = Number(t.amount);
    if (amount <= 0) continue;
    const day = byDate.get(t.work_date) ?? [];
    if (day.length === 0) {
      unallocatedCents += Math.round(amount * 100);
      continue;
    }
    const alloc = splitProportional(amount, day.map((s) => Number(s.hours)));
    day.forEach((s, i) => {
      shares.set(
        s.employee_id,
        round2((shares.get(s.employee_id) ?? 0) + alloc[i]),
      );
    });
  }
  return { shares, unallocated: unallocatedCents / 100 };
}

// ---------- Weekly payout plan (tips-waterfall) ----------
// Tips first bring everyone up to the target hourly ("guarantee"); whatever
// remains is an end-of-week bonus split by hours. The owner only adds money
// when the pool can't fund the guarantee.

export type PayoutPerson = { id: string; hours: number; wages: number };

export type PayoutPlan = {
  perPerson: {
    id: string;
    guarantee: number; // tips used to reach the target
    bonus: number; // share of leftover tips (by hours)
    fromTips: number; // guarantee + bonus
    ownerAdds: number; // top-up from the owner when tips fall short
    total: number; // wages + fromTips + ownerAdds
    effective: number | null; // total / hours
  }[];
  totalNeed: number; // sum of gaps to target
  tipsToGuarantee: number;
  bonusPool: number;
  ownerAdds: number;
  covered: boolean; // pool fully funds the guarantee
};

export function planPayout(
  people: PayoutPerson[],
  pool: number,
  target: number,
): PayoutPlan {
  const needs = people.map((p) =>
    Math.max(0, round2(target * p.hours - p.wages)),
  );
  const totalNeed = round2(needs.reduce((a, b) => a + b, 0));
  const poolCents = Math.round(pool * 100);
  const needCents = Math.round(totalNeed * 100);
  const covered = needCents <= poolCents;
  let guarantees: number[];
  let bonuses: number[];
  let bonusPool = 0;
  if (covered) {
    guarantees = needs;
    bonusPool = round2((poolCents - needCents) / 100);
    bonuses = splitProportional(bonusPool, people.map((p) => p.hours));
  } else {
    // Pool can't cover everyone: distribute it proportional to each gap.
    guarantees = splitProportional(pool, needs);
    bonuses = people.map(() => 0);
  }
  const perPerson = people.map((p, i) => {
    const fromTips = round2(guarantees[i] + bonuses[i]);
    const ownerAdds = round2(Math.max(0, needs[i] - guarantees[i]));
    const total = round2(p.wages + fromTips + ownerAdds);
    return {
      id: p.id,
      guarantee: guarantees[i],
      bonus: bonuses[i],
      fromTips,
      ownerAdds,
      total,
      effective: p.hours > 0 ? round2(total / p.hours) : null,
    };
  });
  return {
    perPerson,
    totalNeed,
    tipsToGuarantee: round2(Math.min(totalNeed, pool)),
    bonusPool,
    ownerAdds: round2(perPerson.reduce((a, p) => a + p.ownerAdds, 0)),
    covered,
  };
}
