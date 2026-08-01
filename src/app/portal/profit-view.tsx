"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DailySales,
  type DayProfit,
  type Settings,
  type Shift,
  type TipDay,
  dayProfit,
  fmtDayShort,
  fmtMoney,
  parseDateStr,
  parseSquareReport,
  round2,
  shiftPay,
  toDateStr,
} from "@/lib/portal";
import { projectIncome } from "@/lib/insights";
import { Card, Modal, SectionLabel, btnSolidCls, inputCls } from "./ui";
import { ColumnChart } from "./charts";

// Chart hue — validated (dataviz six checks) against the cream surface.
const HUE = "#2d4f9e";

type Props = {
  supabase: SupabaseClient;
  shifts: Shift[];
  tips: TipDay[];
  sales: DailySales[];
  settings: Settings;
  salesReady: boolean;
  onChange: () => Promise<void>;
  notify: (msg: string) => void;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

const COST_FIELDS = [
  ["mini_cost", "Mini (6oz) cost"],
  ["regular_cost", "Regular (8oz) cost"],
  ["super_cost", "Super (10oz) cost"],
  ["topping_cost", "Extra topping cost"],
  ["landlord_pct", "Landlord share %"],
] as const;

const MONEY_FIELDS = [
  ["net_sales", "Net sales $"],
  ["tax", "Tax $"],
  ["fees", "Fees $"],
] as const;

const COUNT_FIELDS = [
  ["mini_cups", "Mini"],
  ["regular_cups", "Regular"],
  ["super_cups", "Super"],
  ["toppings", "Xtra top."],
] as const;

type FormState = {
  net_sales: string;
  tax: string;
  fees: string;
  mini_cups: string;
  regular_cups: string;
  super_cups: string;
  toppings: string;
};

const emptyForm: FormState = {
  net_sales: "", tax: "", fees: "",
  mini_cups: "", regular_cups: "", super_cups: "", toppings: "",
};

function formFrom(sale: DailySales | undefined): FormState {
  if (!sale) return { ...emptyForm };
  return {
    net_sales: String(Number(sale.net_sales)),
    tax: String(Number(sale.tax)),
    fees: String(Number(sale.fees)),
    mini_cups: String(sale.mini_cups),
    regular_cups: String(sale.regular_cups),
    super_cups: String(sale.super_cups),
    toppings: String(sale.toppings),
  };
}

/** Compact money for calendar cells: 2286 -> "2.3k", -120 -> "-120". */
function fmtCompact(v: number): string {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  return a >= 1000 ? `${sign}${(a / 1000).toFixed(1)}k` : `${sign}${Math.round(a)}`;
}

export function ProfitView({
  supabase,
  shifts,
  tips,
  sales,
  settings,
  salesReady,
  onChange,
  notify,
}: Props) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selDate, setSelDate] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [paste, setPaste] = useState("");
  const [parsedTips, setParsedTips] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  function moveMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const laborByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shifts) {
      map.set(s.work_date, round2((map.get(s.work_date) ?? 0) + shiftPay(s)));
    }
    return map;
  }, [shifts]);

  const salesByDate = useMemo(
    () => new Map(sales.map((s) => [s.work_date, s])),
    [sales],
  );

  const profitByDate = useMemo(() => {
    const map = new Map<string, DayProfit>();
    for (const s of sales) {
      map.set(
        s.work_date,
        dayProfit(s, settings, laborByDate.get(s.work_date) ?? 0),
      );
    }
    return map;
  }, [sales, settings, laborByDate]);

  const monthRows = useMemo(
    () =>
      sales
        .filter((s) => s.work_date.startsWith(prefix))
        .map((s) => ({ sales: s, p: profitByDate.get(s.work_date)! })),
    [sales, prefix, profitByDate],
  );

  const monthTips = useMemo(
    () =>
      round2(
        tips
          .filter((t) => t.work_date.startsWith(prefix))
          .reduce((a, t) => a + Number(t.amount), 0),
      ),
    [tips, prefix],
  );

  const totals = useMemo(() => {
    const sum = (f: (r: { sales: DailySales; p: DayProfit }) => number) =>
      round2(monthRows.reduce((a, r) => a + f(r), 0));
    return {
      net: sum((r) => Number(r.sales.net_sales)),
      tax: sum((r) => Number(r.sales.tax)),
      profit: sum((r) => r.p.profit),
      cogs: sum((r) => r.p.cogs),
      labor: sum((r) => r.p.labor),
      fees: sum((r) => Number(r.sales.fees)),
      landlord: sum((r) => r.p.landlordShare),
      cups: monthRows.reduce(
        (a, r) =>
          a +
          r.sales.mini_cups +
          r.sales.regular_cups +
          r.sales.super_cups,
        0,
      ),
      mini: monthRows.reduce((a, r) => a + r.sales.mini_cups, 0),
      regular: monthRows.reduce((a, r) => a + r.sales.regular_cups, 0),
      super: monthRows.reduce((a, r) => a + r.sales.super_cups, 0),
      toppings: monthRows.reduce((a, r) => a + r.sales.toppings, 0),
    };
  }, [monthRows]);

  // Sorted by date for the profit-by-day chart.
  const chartRows = useMemo(
    () =>
      [...monthRows].sort((a, b) =>
        a.sales.work_date.localeCompare(b.sales.work_date),
      ),
    [monthRows],
  );

  // Where each $100 of sales goes (cups / wages / fees / profit).
  const per100 = useMemo(() => {
    if (totals.net <= 0) return null;
    const share = (v: number) => round2((v / totals.net) * 100);
    return {
      cogs: share(totals.cogs),
      labor: share(totals.labor),
      fees: share(totals.fees),
      profit: share(totals.profit),
      landlord: share(totals.landlord),
    };
  }, [totals]);

  // Projections from ALL entered days (not just the viewed month).
  const projection = useMemo(() => {
    const entries = sales.map((s) => ({
      work_date: s.work_date,
      net: Number(s.net_sales),
      profit: dayProfit(s, settings, laborByDate.get(s.work_date) ?? 0).profit,
    }));
    return projectIncome(entries, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, settings, laborByDate]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blanks = (first.getDay() + 6) % 7;
    const out: (string | null)[] = Array(blanks).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(toDateStr(new Date(year, month, d)));
    }
    return out;
  }, [year, month]);

  function openDay(dateStr: string) {
    setSelDate(dateStr);
    setForm(formFrom(salesByDate.get(dateStr)));
    setPaste("");
    setParsedTips(null);
  }

  function handlePaste(text: string) {
    setPaste(text);
    const p = parseSquareReport(text);
    const found =
      p.net_sales !== null || p.mini_cups !== null || p.regular_cups !== null;
    if (!found) return;
    setForm((prev) => ({
      net_sales: p.net_sales !== null ? String(p.net_sales) : prev.net_sales,
      tax: p.tax !== null ? String(p.tax) : prev.tax,
      fees: p.fees !== null ? String(p.fees) : prev.fees,
      mini_cups: p.mini_cups !== null ? String(p.mini_cups) : prev.mini_cups,
      regular_cups:
        p.regular_cups !== null ? String(p.regular_cups) : prev.regular_cups,
      super_cups:
        p.super_cups !== null ? String(p.super_cups) : prev.super_cups,
      toppings: p.toppings !== null ? String(p.toppings) : prev.toppings,
    }));
    setParsedTips(p.tips);
    if (p.date && p.date !== selDate) {
      setSelDate(p.date);
      const d = parseDateStr(p.date);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      notify(`Filled from the ${p.date} report`);
    }
  }

  async function saveSales() {
    if (!selDate) return;
    const money = (v: string) => Math.round(Number(v || "0") * 100) / 100;
    const count = (v: string) => Math.round(Number(v || "0"));
    const vals = {
      net_sales: money(form.net_sales),
      tax: money(form.tax),
      fees: money(form.fees),
      mini_cups: count(form.mini_cups),
      regular_cups: count(form.regular_cups),
      super_cups: count(form.super_cups),
      toppings: count(form.toppings),
    };
    if (Object.values(vals).some((v) => !Number.isFinite(v) || v < 0)) {
      notify("Sales numbers can't be negative");
      return;
    }
    setBusy(true);
    const allZero = Object.values(vals).every((v) => v === 0);
    if (allZero) {
      const { error } = await supabase
        .from("daily_sales")
        .delete()
        .eq("work_date", selDate);
      if (error) notify(`Couldn't clear: ${error.message}`);
      else {
        await onChange();
        notify("Sales cleared");
        setSelDate(null);
      }
    } else {
      const { error } = await supabase.from("daily_sales").upsert({
        work_date: selDate,
        ...vals,
        updated_at: new Date().toISOString(),
      });
      if (error) notify(`Couldn't save: ${error.message}`);
      else {
        if (parsedTips !== null && parsedTips > 0) {
          await supabase.from("tips").upsert({
            work_date: selDate,
            amount: Math.round(parsedTips * 100) / 100,
            updated_at: new Date().toISOString(),
          });
        }
        await onChange();
        notify(
          parsedTips !== null && parsedTips > 0
            ? "Sales + tips saved"
            : "Sales saved",
        );
        setSelDate(null);
      }
    }
    setBusy(false);
  }

  const previewProfit = useMemo(() => {
    if (!selDate) return null;
    const money = (v: string) => Number(v || "0");
    const count = (v: string) => Number(v || "0");
    const temp: DailySales = {
      work_date: selDate,
      net_sales: money(form.net_sales),
      tax: money(form.tax),
      fees: money(form.fees),
      mini_cups: count(form.mini_cups),
      regular_cups: count(form.regular_cups),
      super_cups: count(form.super_cups),
      toppings: count(form.toppings),
      updated_at: "",
    };
    if (
      Object.values(temp).some(
        (v) => typeof v === "number" && !Number.isFinite(v),
      )
    ) {
      return null;
    }
    return dayProfit(temp, settings, laborByDate.get(selDate) ?? 0);
  }, [selDate, form, settings, laborByDate]);

  async function saveSetting(
    key: (typeof COST_FIELDS)[number][0],
    input: HTMLInputElement,
  ) {
    const v = Number(input.value);
    const current = Number(settings[key]);
    if (!Number.isFinite(v) || v < 0) {
      notify("Enter a valid number");
      input.value = String(current);
      return;
    }
    if (v === current) return;
    const { error } = await supabase
      .from("settings")
      .update({ [key]: v, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) {
      notify(`Couldn't save: ${error.message}`);
      input.value = String(current);
    } else {
      await onChange();
      notify("Costs updated");
    }
  }

  if (!salesReady) {
    return (
      <Card className="py-10 text-center">
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">
          Run{" "}
          <span className="font-semibold text-charcoal">
            supabase/migration-daily-sales.sql
          </span>{" "}
          in the Supabase SQL Editor to turn on sales &amp; profit tracking.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
          className="flex h-9 w-9 items-center justify-center border border-charcoal/25 transition hover:bg-charcoal hover:text-cream"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="font-display text-base tracking-[0.08em] sm:text-lg">
          {MONTH_NAMES[month]} {year}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => moveMonth(1)}
          className="flex h-9 w-9 items-center justify-center border border-charcoal/25 transition hover:bg-charcoal hover:text-cream"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Month tiles + a slim strip for the money-to-account-for trio */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="text-center">
          <SectionLabel>Net sales</SectionLabel>
          <p className="mt-1 font-display text-xl">{fmtMoney(totals.net)}</p>
        </Card>
        <Card className="text-center">
          <SectionLabel>Profit</SectionLabel>
          <p
            className={`mt-1 font-display text-xl ${totals.profit < 0 ? "text-[#a04a4a]" : ""}`}
          >
            {fmtMoney(totals.profit)}
          </p>
        </Card>
      </div>
      <Card className="!py-2.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
              Tax to set aside
            </p>
            <p className="mt-0.5 font-display text-base text-[#2d4f9e]">
              {fmtMoney(totals.tax)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
              Card fees
            </p>
            <p className="mt-0.5 font-display text-base text-[#a04a4a]">
              {fmtMoney(totals.fees)}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
              Tips
            </p>
            <p className="mt-0.5 font-display text-base text-[#5a7d4f]">
              {fmtMoney(monthTips)}
            </p>
          </div>
        </div>
      </Card>

      {monthRows.length > 0 && (
        <p className="text-center text-[10px] leading-relaxed text-muted/80">
          Profit = net sales − cups cost ({fmtMoney(totals.cogs)}) − wages (
          {fmtMoney(totals.labor)}) − card fees ({fmtMoney(totals.fees)}).
          <br />
          Landlord share ({Number(settings.landlord_pct)}%):{" "}
          {fmtMoney(totals.landlord)} — after it:{" "}
          <span className="font-semibold text-charcoal">
            {fmtMoney(round2(totals.profit - totals.landlord))}
          </span>
        </p>
      )}

      {/* Profit calendar */}
      <p className="text-center text-[10px] text-muted">
        Tap a day to paste the Square email or enter sales.
      </p>
      <div className="grid grid-cols-7 gap-px border border-charcoal/15 bg-charcoal/15 sm:-ml-[5%] sm:w-[110%]">
        {DAY_HEADERS.map((h, i) => (
          <div
            key={`${h}-${i}`}
            className="bg-cream py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-muted"
          >
            {h}
          </div>
        ))}
        {cells.map((dateStr, i) =>
          dateStr === null ? (
            <div key={`blank-${i}`} className="min-h-14 bg-cream/60 sm:min-h-16" />
          ) : (
            <button
              key={dateStr}
              type="button"
              onClick={() => openDay(dateStr)}
              className={`flex min-h-14 flex-col items-center justify-between bg-cream-soft p-1 transition hover:bg-cream-deep sm:min-h-16 ${
                dateStr === todayStr
                  ? "outline outline-1 -outline-offset-1 outline-charcoal"
                  : ""
              }`}
            >
              <span
                className={`self-start px-0.5 text-[11px] ${
                  dateStr === todayStr
                    ? "font-bold text-charcoal"
                    : "text-charcoal-soft"
                }`}
              >
                {Number(dateStr.slice(8))}
              </span>
              {profitByDate.has(dateStr) && (
                <span
                  className={`pb-0.5 text-[10px] font-semibold ${
                    profitByDate.get(dateStr)!.profit < 0
                      ? "text-[#a04a4a]"
                      : "text-[#5a7d4f]"
                  }`}
                >
                  {fmtCompact(profitByDate.get(dateStr)!.profit)}
                </span>
              )}
            </button>
          ),
        )}
      </div>

      {/* Charts — only once there's data this month */}
      {monthRows.length > 0 && (
        <>
          {totals.cups > 0 && (
            <p className="text-center text-[11px] text-muted">
              ≈{" "}
              <span className="font-semibold text-charcoal">
                {fmtMoney(round2(totals.net / totals.cups))}
              </span>{" "}
              per cup ·{" "}
              <span className="font-semibold text-charcoal">
                {Math.round(totals.cups / monthRows.length)}
              </span>{" "}
              cups/day avg
            </p>
          )}

          <Card>
            <SectionLabel>Profit by day</SectionLabel>
            <p className="mb-3 mt-1 text-[10px] text-muted/80">
              Tap a bar for margin and cup detail.
            </p>
            <ColumnChart
              ariaLabel="Netish profit for each day with sales this month"
              groups={chartRows.map((r) => ({
                label: String(Number(r.sales.work_date.slice(8))),
                values: [Math.max(0, r.p.profit)],
              }))}
              colors={[HUE]}
              detail={(i) => {
                const r = chartRows[i];
                if (!r) return "";
                const net = Number(r.sales.net_sales);
                const margin =
                  net > 0 ? Math.round((r.p.profit / net) * 100) : 0;
                const cups =
                  r.sales.mini_cups + r.sales.regular_cups + r.sales.super_cups;
                return `${fmtDayShort(r.sales.work_date)} · ${fmtMoney(r.p.profit)} profit · ${margin}% of sales · ${cups} cups`;
              }}
            />
          </Card>

          {per100 && (
            <Card>
              <SectionLabel>Where each $100 of sales goes</SectionLabel>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {(
                  [
                    ["Cups", per100.cogs],
                    ["Wages", per100.labor],
                    ["Fees", per100.fees],
                    ["Profit", per100.profit],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label}>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                      {label}
                    </p>
                    <p
                      className={`mt-0.5 font-display text-lg ${
                        label === "Profit"
                          ? v < 0
                            ? "text-[#a04a4a]"
                            : "text-[#5a7d4f]"
                          : ""
                      }`}
                    >
                      ${Number(v.toFixed(0))}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-[10px] text-muted/70">
                Landlord share is separate: ~${Number(per100.landlord.toFixed(0))}{" "}
                of each $100.
              </p>
            </Card>
          )}

          {totals.cups > 0 && (
            <Card>
              <SectionLabel>What you sold</SectionLabel>
              <p className="mb-3 mt-1 text-[10px] text-muted/80">
                Cup counts for the month — tap for share.
              </p>
              <ColumnChart
                ariaLabel="Units sold this month by item"
                fmtValue={(v) => String(Math.round(v))}
                groups={[
                  { label: "Mini", values: [totals.mini] },
                  { label: "Regular", values: [totals.regular] },
                  { label: "Super", values: [totals.super] },
                  { label: "Xtra top.", values: [totals.toppings] },
                ]}
                colors={[HUE]}
                detail={(i) => {
                  const items = [
                    ["Mini", totals.mini],
                    ["Regular", totals.regular],
                    ["Super", totals.super],
                    ["Extra toppings", totals.toppings],
                  ] as const;
                  const [name, v] = items[i] ?? ["", 0];
                  const pct =
                    totals.cups > 0 && i < 3
                      ? ` · ${Math.round((v / totals.cups) * 100)}% of cups`
                      : "";
                  return `${name}: ${v} sold${pct}`;
                }}
              />
            </Card>
          )}
        </>
      )}

      {/* Projections — collapsed; pure weekday averaging over entries */}
      {sales.length >= 3 && (
        <details className="group/proj">
          <summary className="cursor-pointer list-none text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-muted transition hover:text-charcoal">
            <span className="group-open/proj:hidden">▸ Projected income</span>
            <span className="hidden group-open/proj:inline">
              ▾ Hide projected income
            </span>
          </summary>
          <Card className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              <Card className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                  This month · gross
                </p>
                <p className="mt-1 font-display text-lg">
                  {fmtMoney(projection.monthGross)}
                </p>
              </Card>
              <Card className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                  This month · net
                </p>
                <p
                  className={`mt-1 font-display text-lg ${projection.monthNet < 0 ? "text-[#a04a4a]" : "text-[#5a7d4f]"}`}
                >
                  {fmtMoney(projection.monthNet)}
                </p>
              </Card>
              <Card className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Next 90 days · gross
                </p>
                <p className="mt-1 font-display text-lg">
                  {fmtMoney(projection.ninetyGross)}
                </p>
              </Card>
              <Card className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Next 90 days · net
                </p>
                <p
                  className={`mt-1 font-display text-lg ${projection.ninetyNet < 0 ? "text-[#a04a4a]" : "text-[#5a7d4f]"}`}
                >
                  {fmtMoney(projection.ninetyNet)}
                </p>
              </Card>
            </div>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-muted/80">
              This month = {fmtMoney(projection.monthActualGross)} gross /{" "}
              {fmtMoney(projection.monthActualNet)} net logged so far +{" "}
              {projection.monthDaysProjected} estimated day
              {projection.monthDaysProjected === 1 ? "" : "s"}.
              <br />
              Estimates average your last {projection.sampleDays} logged days
              by day of week. Gross = net sales; net = profit after cups,
              wages, fees.
              {projection.zeroWeekdays.length > 0 &&
                projection.zeroWeekdays.length < 7 && (
                  <>
                    {" "}
                    {projection.zeroWeekdays.join("/")} project $0 (no data
                    yet).
                  </>
                )}
            </p>
          </Card>
        </details>
      )}

      {/* Cost settings */}
      <details className="group">
        <summary className="cursor-pointer list-none text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-muted transition hover:text-charcoal">
          <span className="group-open:hidden">▸ Cost settings</span>
          <span className="hidden group-open:inline">▾ Hide cost settings</span>
        </summary>
        <Card className="mt-3">
          <div className="flex flex-col gap-2">
            {COST_FIELDS.map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-muted">{label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  defaultValue={Number(settings[key])}
                  onBlur={(e) => saveSetting(key, e.target)}
                  aria-label={label}
                  className="w-24 border border-charcoal/25 bg-cream px-2 py-1 text-right text-sm outline-none focus:border-charcoal"
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
            Seeded from your cost model (Nova Froyo Ruby.xlsx). Changes apply
            to every day, past and future.
          </p>
        </Card>
      </details>

      {/* Entry modal */}
      {selDate && (
        <Modal
          title={parseDateStr(selDate).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          onClose={() => setSelDate(null)}
        >
          <div className="flex flex-col gap-4">
            <div>
              <SectionLabel>Paste the Square email</SectionLabel>
              <textarea
                value={paste}
                onChange={(e) => handlePaste(e.target.value)}
                placeholder="Copy the whole sales-report email and paste it here — everything below fills in by itself. No AI, just pattern matching."
                rows={3}
                className={`${inputCls} mt-2 resize-y text-xs`}
              />
              {parsedTips !== null && (
                <p className="mt-1 text-[11px] text-[#5a7d4f]">
                  Tips {fmtMoney(parsedTips)} found — will be saved to this
                  day&apos;s tips too.
                </p>
              )}
            </div>

            <div>
              <SectionLabel>Numbers</SectionLabel>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {MONEY_FIELDS.map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
                      {label}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form[key]}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      aria-label={label}
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {COUNT_FIELDS.map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
                      {label}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={form[key]}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      aria-label={`${label} count`}
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
            </div>

            {previewProfit && Number(form.net_sales) > 0 && (
              <p className="text-center text-xs text-muted">
                Est. profit:{" "}
                <span
                  className={`font-display text-base ${previewProfit.profit < 0 ? "text-[#a04a4a]" : "text-[#5a7d4f]"}`}
                >
                  {fmtMoney(previewProfit.profit)}
                </span>{" "}
                <span className="text-[10px]">
                  (cups {fmtMoney(previewProfit.cogs)} · wages{" "}
                  {fmtMoney(previewProfit.labor)})
                </span>
              </p>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={saveSales}
              className={btnSolidCls}
            >
              Save
            </button>
            <p className="text-center text-[10px] text-muted/70">
              Saving with every field at 0 clears the day.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
