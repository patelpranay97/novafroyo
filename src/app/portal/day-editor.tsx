"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Employee,
  type Shift,
  type TipDay,
  fmtMoney,
  parseDateStr,
} from "@/lib/portal";
import { Modal, SectionLabel, btnSolidCls, inputCls } from "./ui";

type Props = {
  supabase: SupabaseClient;
  date: string; // YYYY-MM-DD
  employees: Employee[];
  shifts: Shift[];
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

  async function updateHours(shift: Shift, value: string) {
    const h = Number(value);
    if (!Number.isFinite(h) || h <= 0 || h > 24 || h === Number(shift.hours)) {
      return;
    }
    const { error } = await supabase
      .from("shifts")
      .update({ hours: h })
      .eq("id", shift.id);
    if (error) notify(`Couldn't update hours: ${error.message}`);
    else await onChange();
  }

  async function saveTip() {
    setBusy(true);
    if (tipAmount.trim() === "" || tipNum === 0) {
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
        amount: tipNum,
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
                      onBlur={(e) => updateHours(s, e.target.value)}
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
              <div className="flex gap-2">
                <select
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  aria-label="Employee"
                  className={`${inputCls} flex-1`}
                >
                  <option value="">Add someone…</option>
                  {addable.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
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
                  className={`${inputCls} w-24`}
                />
              </div>
              <div className="flex items-center gap-1.5">
                {QUICK_HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(String(h))}
                    className={`border px-2.5 py-1 text-[11px] transition ${
                      hours === String(h)
                        ? "border-charcoal bg-charcoal text-cream"
                        : "border-charcoal/20 text-muted hover:border-charcoal hover:text-charcoal"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={`${inputCls} ml-auto min-w-0 flex-1`}
                />
              </div>
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
      </div>
    </Modal>
  );
}
