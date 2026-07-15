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
  const range =
    monday.getMonth() === sunday.getMonth()
      ? `${m1} ${monday.getDate()}–${sunday.getDate()}`
      : `${m1} ${monday.getDate()} – ${m2} ${sunday.getDate()}`;
  return `${range}, ${sunday.getFullYear()}`;
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

export function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "5" -> "5h", "5.5" -> "5.5h" */
export function fmtHours(n: number): string {
  return `${Number(n.toFixed(2))}h`;
}
