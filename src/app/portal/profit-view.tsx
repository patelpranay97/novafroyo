"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DailySales,
  type DayProfit,
  type Settings,
  type Shift,
  dayProfit,
  fmtDayShort,
  fmtMoney,
  round2,
  shiftPay,
} from "@/lib/portal";
import { Card, SectionLabel } from "./ui";

type Props = {
  supabase: SupabaseClient;
  shifts: Shift[];
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

const COST_FIELDS = [
  ["mini_cost", "Mini (4oz) cost"],
  ["regular_cost", "Regular (6oz) cost"],
  ["super_cost", "Super (8oz) cost"],
  ["topping_cost", "Extra topping cost"],
  ["landlord_pct", "Landlord share %"],
] as const;

export function ProfitView({
  supabase,
  shifts,
  sales,
  settings,
  salesReady,
  onChange,
  notify,
}: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sel, setSel] = useState<string | null>(null);

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

  const monthRows = useMemo(() => {
    return sales
      .filter((s) => s.work_date.startsWith(prefix))
      .sort((a, b) => b.work_date.localeCompare(a.work_date))
      .map((s) => ({
        sales: s,
        p: dayProfit(s, settings, laborByDate.get(s.work_date) ?? 0),
      }));
  }, [sales, prefix, settings, laborByDate]);

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
    };
  }, [monthRows]);

  async function saveSetting(key: (typeof COST_FIELDS)[number][0], input: HTMLInputElement) {
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

      {/* Month tiles */}
      <div className="grid grid-cols-3 gap-2">
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
        <Card className="text-center">
          <SectionLabel>Tax to set aside</SectionLabel>
          <p className="mt-1 font-display text-xl text-[#2d4f9e]">
            {fmtMoney(totals.tax)}
          </p>
        </Card>
      </div>

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

      {/* Per-day list */}
      {monthRows.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">
            No sales logged this month yet. After close, open the day on the
            Calendar tab and copy the numbers from the Square email into the
            Sales section.
          </p>
        </Card>
      ) : (
        <Card>
          <SectionLabel>Day by day</SectionLabel>
          <div className="mt-3 flex flex-col gap-2">
            {monthRows.map(({ sales: s, p }) => (
              <div key={s.work_date}>
                <button
                  type="button"
                  onClick={() =>
                    setSel(sel === s.work_date ? null : s.work_date)
                  }
                  className="flex w-full items-center justify-between gap-2 text-left text-sm"
                >
                  <span
                    className={
                      sel === s.work_date
                        ? "font-bold text-charcoal"
                        : "text-charcoal"
                    }
                  >
                    {fmtDayShort(s.work_date)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted">
                      {fmtMoney(Number(s.net_sales))} sales
                    </span>
                    <span
                      className={`font-display ${p.profit < 0 ? "text-[#a04a4a]" : "text-[#5a7d4f]"}`}
                    >
                      {fmtMoney(p.profit)}
                    </span>
                  </span>
                </button>
                {sel === s.work_date && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    {s.mini_cups} mini · {s.regular_cups} regular ·{" "}
                    {s.super_cups} super · {s.toppings} toppings
                    <br />
                    cups {fmtMoney(p.cogs)} · wages {fmtMoney(p.labor)} · fees{" "}
                    {fmtMoney(Number(s.fees))} · tax {fmtMoney(Number(s.tax))}
                    <br />
                    landlord {fmtMoney(p.landlordShare)} → after:{" "}
                    {fmtMoney(p.afterLandlord)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
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
    </div>
  );
}
