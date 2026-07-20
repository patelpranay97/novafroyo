"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DailySales,
  type Employee,
  type ScheduledShift,
  type Shift,
  type TipDay,
  fmtMoney,
  fmtTime,
  parseDateStr,
} from "@/lib/portal";
import { Modal, SectionLabel, btnSolidCls, inputCls } from "./ui";

type Props = {
  supabase: SupabaseClient;
  date: string; // YYYY-MM-DD
  employees: Employee[];
  shifts: Shift[];
  scheduled: ScheduledShift[];
  scheduleReady: boolean;
  sale: DailySales | null;
  salesReady: boolean;
  tip: TipDay | null;
  onChange: () => Promise<void>;
  notify: (msg: string) => void;
  onClose: () => void;
};

const QUICK_HOURS = [4, 5, 6, 8];

export function DayEditor({
  supabase,
  date,
  employees,
  shifts,
  scheduled,
  scheduleReady,
  sale,
  salesReady,
  tip,
  onChange,
  notify,
  onClose,
}: Props) {
  const [empId, setEmpId] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [tipAmount, setTipAmount] = useState(
    tip ? String(Number(tip.amount)) : "",
  );
  const [schedEmpId, setSchedEmpId] = useState("");
  const [schedStart, setSchedStart] = useState("12:00");
  const [schedEnd, setSchedEnd] = useState("20:00");
  const [sl, setSl] = useState(() => ({
    net_sales: sale ? String(Number(sale.net_sales)) : "",
    tax: sale ? String(Number(sale.tax)) : "",
    fees: sale ? String(Number(sale.fees)) : "",
    mini_cups: sale ? String(sale.mini_cups) : "",
    regular_cups: sale ? String(sale.regular_cups) : "",
    super_cups: sale ? String(sale.super_cups) : "",
    toppings: sale ? String(sale.toppings) : "",
  }));
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => {
    const d = parseDateStr(date);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [date]);

  const empById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  // Active employees who don't already have a shift this day
  const addable = useMemo(() => {
    const onDay = new Set(shifts.map((s) => s.employee_id));
    return employees.filter((e) => e.active && !onDay.has(e.id));
  }, [employees, shifts]);

  const tipNum = Number(tipAmount);
  const workedCount = shifts.length;

  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    const emp = empById.get(empId);
    const h = Number(hours);
    if (!emp || !Number.isFinite(h) || h <= 0 || h > 24) {
      notify("Pick a person and hours between 0 and 24");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("shifts").insert({
      employee_id: emp.id,
      work_date: date,
      hours: h,
      rate: Number(emp.hourly_rate),
      note: note.trim() || null,
    });
    if (error) notify(`Couldn't add shift: ${error.message}`);
    else {
      await onChange();
      setEmpId("");
      setHours("");
      setNote("");
    }
    setBusy(false);
  }

  async function removeShift(shift: Shift) {
    setBusy(true);
    const { error } = await supabase.from("shifts").delete().eq("id", shift.id);
    if (error) notify(`Couldn't remove: ${error.message}`);
    else await onChange();
    setBusy(false);
  }

  async function updateHours(shift: Shift, input: HTMLInputElement) {
    const raw = input.value.trim();
    const h = Number(raw);
    const original = Number(shift.hours);
    // Reject blank/out-of-range instead of silently dropping — revert the field.
    if (raw === "" || !Number.isFinite(h) || h <= 0 || h > 24) {
      input.value = String(original);
      if (raw !== "") notify("Hours must be between 0 and 24");
      return;
    }
    if (h === original) return;
    // If this shift was already paid, changing the hours changes what's owed —
    // reopen it as unpaid so the new balance resurfaces in This Week.
    const wasPaid = shift.paid_at != null;
    const patch: { hours: number; paid_at?: null } = { hours: h };
    if (wasPaid) patch.paid_at = null;
    const { error } = await supabase
      .from("shifts")
      .update(patch)
      .eq("id", shift.id);
    if (error) {
      notify(`Couldn't update hours: ${error.message}`);
      input.value = String(original);
    } else {
      await onChange();
      if (wasPaid) notify("Hours changed — shift reopened as unpaid");
    }
  }

  async function addScheduled(e: React.FormEvent) {
    e.preventDefault();
    const emp = empById.get(schedEmpId);
    if (!emp || !schedStart || !schedEnd) {
      notify("Pick a person and start/end times");
      return;
    }
    // "00:00" as the end means midnight (closing shift); anything else that
    // isn't after the start is an overnight shift, which isn't supported.
    if (schedEnd !== "00:00" && schedEnd <= schedStart) {
      notify("End must be after start — overnight shifts aren't supported (midnight is OK)");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("schedule").insert({
      employee_id: emp.id,
      work_date: date,
      start_time: schedStart,
      end_time: schedEnd,
    });
    if (error) {
      notify(
        error.code === "23505"
          ? `${emp.name} is already scheduled that day`
          : `Couldn't schedule: ${error.message}`,
      );
    } else {
      await onChange();
      setSchedEmpId("");
    }
    setBusy(false);
  }

  async function removeScheduled(s: ScheduledShift) {
    setBusy(true);
    const { error } = await supabase.from("schedule").delete().eq("id", s.id);
    if (error) notify(`Couldn't remove: ${error.message}`);
    else await onChange();
    setBusy(false);
  }

  async function saveSales() {
    const money = (v: string) => Math.round(Number(v || "0") * 100) / 100;
    const count = (v: string) => Math.round(Number(v || "0"));
    const vals = {
      net_sales: money(sl.net_sales),
      tax: money(sl.tax),
      fees: money(sl.fees),
      mini_cups: count(sl.mini_cups),
      regular_cups: count(sl.regular_cups),
      super_cups: count(sl.super_cups),
      toppings: count(sl.toppings),
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
        .eq("work_date", date);
      if (error) notify(`Couldn't clear sales: ${error.message}`);
      else {
        await onChange();
        notify("Sales cleared");
      }
    } else {
      const { error } = await supabase.from("daily_sales").upsert({
        work_date: date,
        ...vals,
        updated_at: new Date().toISOString(),
      });
      if (error) notify(`Couldn't save sales: ${error.message}`);
      else {
        await onChange();
        notify("Sales saved — see the Profit tab");
      }
    }
    setBusy(false);
  }

  async function saveTip() {
    setBusy(true);
    // Round to whole cents up front — the DB column is numeric(8,2), and a
    // sub-cent entry that rounds to 0 must clear the row, not store $0.00.
    const rounded = Math.round(tipNum * 100) / 100;
    if (tipAmount.trim() === "" || rounded === 0) {
      const { error } = await supabase
        .from("tips")
        .delete()
        .eq("work_date", date);
      if (error) notify(`Couldn't clear tips: ${error.message}`);
      else {
        await onChange();
        notify("Tips cleared");
      }
    } else if (!Number.isFinite(tipNum) || tipNum < 0) {
      notify("Tips need to be a positive amount");
    } else {
      const { error } = await supabase.from("tips").upsert({
        work_date: date,
        amount: rounded,
        updated_at: new Date().toISOString(),
      });
      if (error) notify(`Couldn't save tips: ${error.message}`);
      else {
        await onChange();
        notify("Tips saved");
      }
    }
    setBusy(false);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-6">
        {/* Shifts on this day */}
        <div>
          <SectionLabel>Who worked</SectionLabel>
          {shifts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No one logged yet.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {shifts.map((s) => {
                const emp = empById.get(s.employee_id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 border border-charcoal/15 bg-cream-soft p-2"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: emp?.color ?? "#999" }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {emp?.name ?? "Unknown"}
                      {s.paid_at && (
                        <span className="ml-2 align-middle text-[9px] font-semibold uppercase tracking-[0.15em] text-[#5a7d4f]">
                          Paid
                        </span>
                      )}
                      {s.note && (
                        <span className="ml-2 text-xs text-muted">
                          {s.note}
                        </span>
                      )}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      min="0.25"
                      max="24"
                      defaultValue={Number(s.hours)}
                      onBlur={(e) => updateHours(s, e.target)}
                      aria-label={`Hours for ${emp?.name ?? "employee"}`}
                      className="w-16 border border-charcoal/25 bg-cream px-2 py-1 text-right text-sm outline-none focus:border-charcoal"
                    />
                    <span className="text-xs text-muted">h</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeShift(s)}
                      aria-label={`Remove ${emp?.name ?? "employee"}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center border border-charcoal/20 text-muted transition hover:border-[#a04a4a] hover:text-[#a04a4a] disabled:opacity-40"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3" aria-hidden="true">
                        <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add shift */}
          {addable.length > 0 ? (
            <form onSubmit={addShift} className="mt-3 flex flex-col gap-2">
              <select
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                aria-label="Employee"
                className={inputCls}
              >
                <option value="">Add someone…</option>
                {addable.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0.25"
                  max="24"
                  placeholder="Hours"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  aria-label="Hours"
                  className="w-24 shrink-0 rounded-none border border-charcoal/25 bg-cream-soft px-3 py-2 text-sm text-charcoal outline-none transition placeholder:text-muted/60 focus:border-charcoal"
                />
                {QUICK_HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(String(h))}
                    className={`flex-1 border px-2 py-2 text-[11px] transition ${
                      hours === String(h)
                        ? "border-charcoal bg-charcoal text-cream"
                        : "border-charcoal/20 text-muted hover:border-charcoal hover:text-charcoal"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls}
              />
              <button
                type="submit"
                disabled={busy || !empId || !hours}
                className={btnSolidCls}
              >
                Add shift
              </button>
            </form>
          ) : (
            employees.filter((e) => e.active).length === 0 && (
              <p className="mt-3 text-xs text-muted">
                Add your employees on the Team tab first.
              </p>
            )
          )}
        </div>

        {/* Scheduled (planned) shifts */}
        <div>
          <SectionLabel>Scheduled</SectionLabel>
          {!scheduleReady ? (
            <p className="mt-2 text-xs text-muted">
              Run <span className="font-semibold text-charcoal">
                supabase/migration-scheduling.sql
              </span>{" "}
              in the Supabase SQL Editor to turn on scheduling.
            </p>
          ) : (
            <>
              {scheduled.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  No one scheduled yet.
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {scheduled.map((s) => {
                    const emp = empById.get(s.employee_id);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 border border-charcoal/15 bg-cream-soft p-2"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
                          style={{ borderColor: emp?.color ?? "#999" }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {emp?.name ?? "Unknown"}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => removeScheduled(s)}
                          aria-label={`Unschedule ${emp?.name ?? "employee"}`}
                          className="flex h-7 w-7 shrink-0 items-center justify-center border border-charcoal/20 text-muted transition hover:border-[#a04a4a] hover:text-[#a04a4a] disabled:opacity-40"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3" aria-hidden="true">
                            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {(() => {
                const onDay = new Set(scheduled.map((s) => s.employee_id));
                const schedulable = employees.filter(
                  (e) => e.active && !onDay.has(e.id),
                );
                if (schedulable.length === 0) return null;
                return (
                  <form
                    onSubmit={addScheduled}
                    className="mt-3 flex flex-col gap-2"
                  >
                    <select
                      value={schedEmpId}
                      onChange={(e) => setSchedEmpId(e.target.value)}
                      aria-label="Employee to schedule"
                      className={inputCls}
                    >
                      <option value="">Schedule someone…</option>
                      {schedulable.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={schedStart}
                        onChange={(e) => setSchedStart(e.target.value)}
                        aria-label="Start time"
                        className={`${inputCls} flex-1`}
                      />
                      <span className="text-xs text-muted">to</span>
                      <input
                        type="time"
                        value={schedEnd}
                        onChange={(e) => setSchedEnd(e.target.value)}
                        aria-label="End time"
                        className={`${inputCls} flex-1`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !schedEmpId}
                      className={btnSolidCls}
                    >
                      Add to schedule
                    </button>
                  </form>
                );
              })()}
            </>
          )}
        </div>

        {/* Tips */}
        <div>
          <SectionLabel>Tips for the day</SectionLabel>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                aria-label="Tip amount"
                className={`${inputCls} pl-7`}
              />
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={saveTip}
              className={btnSolidCls}
            >
              Save
            </button>
          </div>
          {Number.isFinite(tipNum) && tipNum > 0 && workedCount > 0 && (
            <p className="mt-2 text-xs text-muted">
              {fmtMoney(tipNum)} ÷ {workedCount} who worked ={" "}
              <span className="font-semibold text-charcoal">
                {fmtMoney(Math.floor((tipNum / workedCount) * 100) / 100)} each
              </span>
            </p>
          )}
        </div>

        {/* Sales — copied from the end-of-day Square email */}
        <div>
          <SectionLabel>Sales (from the Square email)</SectionLabel>
          {!salesReady ? (
            <p className="mt-2 text-xs text-muted">
              Run{" "}
              <span className="font-semibold text-charcoal">
                supabase/migration-daily-sales.sql
              </span>{" "}
              in the Supabase SQL Editor to turn on sales tracking.
            </p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(
                  [
                    ["net_sales", "Net sales $"],
                    ["tax", "Tax $"],
                    ["fees", "Fees $"],
                  ] as const
                ).map(([key, label]) => (
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
                      value={sl[key]}
                      onChange={(e) =>
                        setSl((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      aria-label={label}
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {(
                  [
                    ["mini_cups", "Mini"],
                    ["regular_cups", "Regular"],
                    ["super_cups", "Super"],
                    ["toppings", "Xtra top."],
                  ] as const
                ).map(([key, label]) => (
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
                      value={sl[key]}
                      onChange={(e) =>
                        setSl((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      aria-label={`${label} count`}
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={saveSales}
                className={`${btnSolidCls} mt-2 w-full`}
              >
                Save sales
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
