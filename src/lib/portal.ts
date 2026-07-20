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
  phone?: string | null;
  is_owner?: boolean;
  created_at: string;
};

export type ScheduledShift = {
  id: string;
  employee_id: string;
  work_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string;
  note: string | null;
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

export type DailySales = {
  work_date: string; // YYYY-MM-DD
  net_sales: number;
  tax: number;
  fees: number;
  mini_cups: number;
  regular_cups: number;
  super_cups: number;
  toppings: number;
  updated_at: string;
};

export type Settings = {
  id: number;
  mini_cost: number;
  regular_cost: number;
  super_cost: number;
  topping_cost: number;
  landlord_pct: number;
  updated_at: string;
};

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  mini_cost: 1.18,
  regular_cost: 1.89,
  super_cost: 2.61,
  topping_cost: 0.5,
  landlord_pct: 10,
  updated_at: "",
};

// ---------- Square daily-report paste parser (pure regex, no AI) ----------

export type ParsedSquareReport = {
  date: string | null; // YYYY-MM-DD from the report's coverage line
  net_sales: number | null;
  tax: number | null;
  fees: number | null;
  tips: number | null;
  mini_cups: number | null;
  regular_cups: number | null;
  super_cups: number | null;
  toppings: number | null;
};

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function moneyAfter(text: string, label: RegExp): number | null {
  const m = text.match(label);
  if (!m) return null;
  return Number(m[1].replace(/,/g, ""));
}

/**
 * Pull the day's numbers out of a pasted Square "Sales Report" email.
 * Item rows come in pairs (item line, then its "Regular × N" size-variant
 * line with the same count), so even-indexed rows in the Item Sales
 * section are the real items — that's how the "Regular" cup is told apart
 * from the variant lines.
 */
export function parseSquareReport(text: string): ParsedSquareReport {
  const out: ParsedSquareReport = {
    date: null, net_sales: null, tax: null, fees: null, tips: null,
    mini_cups: null, regular_cups: null, super_cups: null, toppings: null,
  };

  const d = text.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),\s+(\d{4})\s+12:00\s*AM/i,
  ) ?? text.match(
    /Reported on\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),\s+(\d{4})/i,
  );
  if (d) {
    const mo = MONTH_ABBR[d[1].toLowerCase().slice(0, 3)];
    out.date = `${d[3]}-${String(mo).padStart(2, "0")}-${String(Number(d[2])).padStart(2, "0")}`;
  }

  out.net_sales = moneyAfter(text, /Net Sales\s*\$?([\d,]+\.?\d*)/i);
  out.tax = moneyAfter(text, /\bTax\s*\$?([\d,]+\.?\d*)/i);
  out.tips = moneyAfter(text, /\bTips\s*\$?([\d,]+\.?\d*)/i);
  out.fees = moneyAfter(text, /\bFees\s*\(?\$?([\d,]+\.?\d*)\)?/i);

  const itemSection = text.split(/Item Sales/i)[1] ?? text;
  const rows = [
    ...itemSection.matchAll(/([A-Za-z][A-Za-z .]*?)\s*×\s*(\d+)\s*\$?([\d,]+\.?\d*)/g),
  ].map((m) => ({ name: m[1].trim(), count: Number(m[2]) }));
  // Even indices are the items; odd are their size-variant echo lines.
  const items = rows.filter((_, i) => i % 2 === 0);
  for (const it of items) {
    if (/extra\s*topping/i.test(it.name)) out.toppings = it.count;
    else if (/mini/i.test(it.name)) out.mini_cups = it.count;
    else if (/super/i.test(it.name)) out.super_cups = it.count;
    else if (/^regular$/i.test(it.name)) out.regular_cups = it.count;
  }
  // Fallback for the Regular cup if pairing didn't identify it: its count is
  // the one echoed twice among "Regular × N" lines (item + its own variant).
  if (out.regular_cups === null) {
    const regCounts = rows
      .filter((r) => /^regular$/i.test(r.name))
      .map((r) => r.count);
    const tally = new Map<number, number>();
    for (const c of regCounts) tally.set(c, (tally.get(c) ?? 0) + 1);
    const known = [out.toppings, out.mini_cups, out.super_cups];
    for (const k of known) {
      if (k !== null && tally.has(k)) tally.set(k, (tally.get(k) ?? 0) - 1);
    }
    let best: number | null = null;
    for (const [count, n] of tally) if (n >= 2) best = count;
    out.regular_cups = best ?? null;
  }
  return out;
}

export type DayProfit = {
  cogs: number;
  labor: number;
  profit: number; // net_sales - cogs - labor - fees (before landlord share)
  landlordShare: number; // shown separately, never subtracted from profit
  afterLandlord: number;
};

/** Netish profit for one day. Labor = that day's wages (hours × rate). */
export function dayProfit(
  sales: DailySales,
  settings: Settings,
  labor: number,
): DayProfit {
  const cogs = round2(
    Number(sales.mini_cups) * Number(settings.mini_cost) +
      Number(sales.regular_cups) * Number(settings.regular_cost) +
      Number(sales.super_cups) * Number(settings.super_cost) +
      Number(sales.toppings) * Number(settings.topping_cost),
  );
  const profit = round2(
    Number(sales.net_sales) - cogs - labor - Number(sales.fees),
  );
  const landlordShare = round2(
    (Number(sales.net_sales) * Number(settings.landlord_pct)) / 100,
  );
  return {
    cogs,
    labor: round2(labor),
    profit,
    landlordShare,
    afterLandlord: round2(profit - landlordShare),
  };
}

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

/** "14:30:00" or "14:30" -> "2:30 PM"; "09:00" -> "9 AM" */
export function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${ampm}` : `${h12} ${ampm}`;
}

/** Compact chip form: "12–8" / "11:30–7" (minutes only when nonzero). */
export function fmtTimeChip(start: string, end: string): string {
  const part = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`;
  };
  return `${part(start)}–${part(end)}`;
}

/**
 * Rebuild a phone number from its digits (keeping a leading + only) for
 * sms:/tel: links. Null when it can't be a real number: fewer than 10
 * digits, or more than 15 (E.164 max — also rejects "555-1234 x22" style
 * extensions that would otherwise merge into a wrong number).
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return (raw.trim().startsWith("+") ? "+" : "") + digits;
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
// Tips first bring STAFF (non-owners) up to the target hourly ("guarantee").
// Owners are excluded from the guarantee: whatever is left over after staff
// are covered is the owner's to distribute at their discretion (to
// themselves and/or as bonuses) — the plan reports the leftover but does
// not allocate it. The business only adds money when the pool can't fund
// the staff guarantee.

export type PayoutPerson = {
  id: string;
  hours: number;
  wages: number;
  isOwner?: boolean;
};

export type PayoutPlan = {
  perPerson: {
    id: string;
    isOwner: boolean;
    guarantee: number; // tips used to reach the target (0 for owners)
    fromTips: number; // == guarantee
    ownerAdds: number; // top-up from the business when tips fall short
    total: number; // wages + fromTips + ownerAdds
    effective: number | null; // total / hours (null for owners)
  }[];
  totalNeed: number; // sum of staff gaps to target
  tipsToGuarantee: number;
  leftover: number; // pool remaining after staff guarantees — owner decides
  ownerAdds: number;
  covered: boolean; // pool fully funds the staff guarantee
};

export function planPayout(
  people: PayoutPerson[],
  pool: number,
  target: number,
): PayoutPlan {
  const needs = people.map((p) =>
    p.isOwner ? 0 : Math.max(0, round2(target * p.hours - p.wages)),
  );
  const totalNeed = round2(needs.reduce((a, b) => a + b, 0));
  const poolCents = Math.round(pool * 100);
  const needCents = Math.round(totalNeed * 100);
  const covered = needCents <= poolCents;
  const guarantees = covered
    ? needs
    : // Pool can't cover staff: distribute it proportional to each gap.
      splitProportional(pool, needs);
  const leftover = covered ? round2((poolCents - needCents) / 100) : 0;
  const perPerson = people.map((p, i) => {
    const fromTips = round2(guarantees[i]);
    const ownerAdds = round2(Math.max(0, needs[i] - guarantees[i]));
    const total = round2(p.wages + fromTips + ownerAdds);
    return {
      id: p.id,
      isOwner: !!p.isOwner,
      guarantee: guarantees[i],
      fromTips,
      ownerAdds,
      total,
      effective:
        !p.isOwner && p.hours > 0 ? round2(total / p.hours) : null,
    };
  });
  return {
    perPerson,
    totalNeed,
    tipsToGuarantee: round2(Math.min(totalNeed, pool)),
    leftover,
    ownerAdds: round2(perPerson.reduce((a, p) => a + p.ownerAdds, 0)),
    covered,
  };
}
