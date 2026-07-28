"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type InventoryDay,
  addDays,
  fmtDayShort,
  parseDateStr,
  toDateStr,
} from "@/lib/portal";
import { Card, SectionLabel, btnSolidCls } from "./ui";

type Props = {
  supabase: SupabaseClient;
  inventory: InventoryDay[];
  invReady: boolean;
  onChange: () => Promise<void>;
  notify: (msg: string) => void;
};

const BATCH_FIELDS = [
  ["batches_made", "Batches made today"],
  ["batches_left", "Batches left tonight"],
] as const;

const INGREDIENT_FIELDS = [
  ["kefir", "Kefir (bottles)"],
  ["yogurt", "Yogurt (tubs)"],
  ["milk", "Milk (cartons)"],
  ["stabilizer", "Stabilizer (packs)"],
  ["milk_powder", "Milk powder (bags)"],
  ["sugar", "Sugar (bags)"],
] as const;

type FieldKey =
  | (typeof BATCH_FIELDS)[number][0]
  | (typeof INGREDIENT_FIELDS)[number][0];

type FormState = Record<FieldKey, number>;

const ZERO_FORM: FormState = {
  batches_made: 0,
  batches_left: 0,
  kefir: 0,
  yogurt: 0,
  milk: 0,
  stabilizer: 0,
  milk_powder: 0,
  sugar: 0,
};

function formFrom(row: InventoryDay | undefined, prev?: InventoryDay): FormState {
  if (row) {
    const out = { ...ZERO_FORM };
    for (const k of Object.keys(ZERO_FORM) as FieldKey[]) {
      out[k] = Number(row[k]) || 0;
    }
    return out;
  }
  // New night: ingredients carry over from the last count; batches start 0.
  const out = { ...ZERO_FORM };
  if (prev) {
    for (const [k] of INGREDIENT_FIELDS) out[k] = Number(prev[k]) || 0;
  }
  return out;
}

function Stepper({
  label,
  value,
  low,
  onStep,
  onSet,
}: {
  label: string;
  value: number;
  low?: boolean;
  /** Functional delta so rapid taps can never read a stale value. */
  onStep: (delta: number) => void;
  onSet: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-sm ${low ? "font-semibold text-[#a04a4a]" : "text-charcoal"}`}>
        {label}
      </span>
      <div className="flex items-center border border-charcoal/25">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onStep(-1)}
          className="px-3 py-1.5 text-base transition hover:bg-charcoal hover:text-cream"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          onChange={(e) => {
            onSet(Math.max(0, Math.round(Number(e.target.value) || 0)));
          }}
          aria-label={label}
          className={`w-12 border-x border-charcoal/25 bg-cream py-1.5 text-center text-sm outline-none focus:bg-cream-soft ${low ? "font-semibold text-[#a04a4a]" : ""}`}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onStep(1)}
          className="px-3 py-1.5 text-base transition hover:bg-charcoal hover:text-cream"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function StockView({
  supabase,
  inventory,
  invReady,
  onChange,
  notify,
}: Props) {
  const [dateStr, setDateStr] = useState(() => toDateStr(new Date()));
  const byDate = useMemo(
    () => new Map(inventory.map((r) => [r.work_date, r])),
    [inventory],
  );
  const prevEntry = useMemo(
    () =>
      [...inventory]
        .filter((r) => r.work_date < dateStr)
        .sort((a, b) => b.work_date.localeCompare(a.work_date))[0],
    [inventory, dateStr],
  );

  const [form, setForm] = useState<FormState>(() =>
    formFrom(byDate.get(dateStr), prevEntry),
  );
  const [busy, setBusy] = useState(false);

  // Render-time reset when the viewed date (or its saved row) changes.
  const [seenKey, setSeenKey] = useState(
    `${dateStr}|${byDate.get(dateStr)?.updated_at ?? ""}`,
  );
  const currentKey = `${dateStr}|${byDate.get(dateStr)?.updated_at ?? ""}`;
  if (currentKey !== seenKey) {
    setSeenKey(currentKey);
    setForm(formFrom(byDate.get(dateStr), prevEntry));
  }

  function moveDay(delta: number) {
    setDateStr(toDateStr(addDays(parseDateStr(dateStr), delta)));
  }

  const isToday = dateStr === toDateStr(new Date());
  const hasEntry = byDate.has(dateStr);

  // Live "since last count" deltas for the ingredients.
  const deltas = useMemo(() => {
    if (!prevEntry) return null;
    const parts: string[] = [];
    for (const [k, label] of INGREDIENT_FIELDS) {
      const d = form[k] - (Number(prevEntry[k]) || 0);
      if (d !== 0) {
        const short = label.split(" ")[0];
        parts.push(d < 0 ? `${short} ${d}` : `${short} +${d} (restock)`);
      }
    }
    return parts;
  }, [form, prevEntry]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("inventory").upsert({
      work_date: dateStr,
      ...form,
      updated_at: new Date().toISOString(),
    });
    if (error) notify(`Couldn't save: ${error.message}`);
    else {
      await onChange();
      notify("Stock saved");
    }
    setBusy(false);
  }

  if (!invReady) {
    return (
      <Card className="py-10 text-center">
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">
          Run{" "}
          <span className="font-semibold text-charcoal">
            supabase/migration-inventory.sql
          </span>{" "}
          in the Supabase SQL Editor to turn on stock tracking.
        </p>
      </Card>
    );
  }

  const history = [...inventory]
    .sort((a, b) => b.work_date.localeCompare(a.work_date))
    .slice(0, 14);

  return (
    <div className="flex flex-col gap-5">
      {/* Day navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => moveDay(-1)}
          className="flex h-9 w-9 items-center justify-center border border-charcoal/25 transition hover:bg-charcoal hover:text-cream"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="text-center">
          <p className="font-display text-base tracking-[0.08em] sm:text-lg">
            {isToday ? "Tonight" : fmtDayShort(dateStr)}
          </p>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDateStr(toDateStr(new Date()))}
              className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-muted underline-offset-2 hover:underline"
            >
              Back to today
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Next day"
          onClick={() => moveDay(1)}
          className="flex h-9 w-9 items-center justify-center border border-charcoal/25 transition hover:bg-charcoal hover:text-cream"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Entry */}
      <Card>
        <SectionLabel>Batches</SectionLabel>
        <div className="mt-3 flex flex-col gap-2.5">
          {BATCH_FIELDS.map(([k, label]) => (
            <Stepper
              key={k}
              label={label}
              value={form[k]}
              onStep={(d) =>
                setForm((p) => ({ ...p, [k]: Math.max(0, p[k] + d) }))
              }
              onSet={(v) => setForm((p) => ({ ...p, [k]: v }))}
            />
          ))}
        </div>

        <div className="mt-5">
          <SectionLabel>Ingredients left</SectionLabel>
          {!hasEntry && prevEntry && (
            <p className="mt-1 text-[10px] text-muted/80">
              Prefilled from {fmtDayShort(prevEntry.work_date)} — just adjust
              what changed.
            </p>
          )}
          <div className="mt-3 flex flex-col gap-2.5">
            {INGREDIENT_FIELDS.map(([k, label]) => (
              <Stepper
                key={k}
                label={label}
                value={form[k]}
                low={form[k] <= 1}
                onStep={(d) =>
                  setForm((p) => ({ ...p, [k]: Math.max(0, p[k] + d) }))
                }
                onSet={(v) => setForm((p) => ({ ...p, [k]: v }))}
              />
            ))}
          </div>
        </div>

        {deltas && deltas.length > 0 && (
          <p className="mt-3 text-center text-[11px] text-muted">
            Since {fmtDayShort(prevEntry!.work_date)}: {deltas.join(" · ")}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={save}
          className={`${btnSolidCls} mt-4 w-full`}
        >
          {hasEntry ? "Update stock" : "Save stock"}
        </button>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <SectionLabel>Last counts</SectionLabel>
          <div className="mt-3 flex flex-col gap-2.5">
            {history.map((r) => (
              <button
                key={r.work_date}
                type="button"
                onClick={() => setDateStr(r.work_date)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between text-sm">
                  <span
                    className={
                      r.work_date === dateStr
                        ? "font-bold text-charcoal"
                        : "text-charcoal"
                    }
                  >
                    {fmtDayShort(r.work_date)}
                  </span>
                  <span className="text-xs text-muted">
                    made {r.batches_made} · left {r.batches_left}
                  </span>
                </div>
                <p className="text-[10px] text-muted/80">
                  kefir {r.kefir} · yogurt {r.yogurt} · milk {r.milk} · stab{" "}
                  {r.stabilizer} · powder {r.milk_powder} · sugar {r.sugar}
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
