"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Employee,
  type ScheduledShift,
  type Shift,
  type TipDay,
  fmtMoney,
  fmtTime,
  fmtTimeChip,
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
  tip: TipDay | null;
  onChange: () => Promise<void>;
  notify: (msg: string) => void;
  onClose: () => void;
};

export function DayEditor({
  supabase,
  date,
  employees,
  shifts,
  scheduled,
  scheduleReady,
  tip,
  onChange,
  notify,
  onClose,
}: Props) {
  const [empId, setEmpId] = useState("");
  const [workedStart, setWorkedStart] = useState("17:00");
  const [workedEnd, setWorkedEnd] = useState("22:00");
  const [note, setNote] = useState("");
  const [tipAmount, setTipAmount] = useState(
    tip ? String(Number(tip.amount)) : "",
  );
  const [schedEmpId, setSchedEmpId] = useState("");
  const [schedStart, setSchedStart] = useState("12:00");
  const [schedEnd, setSchedEnd] = useState("20:00");
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

  // Anyone active can work multiple separate blocks in a day.
  const addable = useMemo(
    () => employees.filter((e) => e.active),
    [employees],
  );

  const tipNum = Number(tipAmount);
  // People, not shift rows — someone with two blocks counts once.
  const workedCount = new Set(shifts.map((s) => s.employee_id)).size;

  /** Overlap vs the person's existing TIMED worked shifts. */
  function workedOverlaps(employeeId: string, start: string, end: string) {
    return shifts.some(
      (sh) =>
        sh.employee_id === employeeId &&
        sh.start_time &&
        sh.end_time &&
        timeToMin(start) < endToMin(sh.end_time) &&
        endToMin(end) > timeToMin(sh.start_time),
    );
  }

  /** Insert a worked shift; falls back to hours-only if the times
   *  migration hasn't been run yet (missing-column error). */
  async function insertWorked(
    employeeId: string,
    hoursVal: number,
    start: string | null,
    end: string | null,
    noteVal: string | null,
  ) {
    const emp = empById.get(employeeId);
    const base: Record<string, unknown> = {
      employee_id: employeeId,
      work_date: date,
      hours: hoursVal,
      rate: Number(emp?.hourly_rate ?? 0),
      note: noteVal,
    };
    const withTimes: Record<string, unknown> =
      start && end ? { ...base, start_time: start, end_time: end } : base;
    let { error } = await supabase.from("shifts").insert(withTimes);
    if (error && error.code === "PGRST204" && start && end) {
      ({ error } = await supabase.from("shifts").insert(base));
      if (!error) {
        notify(
          "Saved hours only — run migration-shift-times.sql to store exact times",
        );
      }
    }
    return error;
  }

  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    const emp = empById.get(empId);
    if (!emp || !workedStart || !workedEnd) {
      notify("Pick a person and start/end times");
      return;
    }
    if (workedEnd !== "00:00" && workedEnd <= workedStart) {
      notify("End must be after start — overnight shifts aren't supported (midnight is OK)");
      return;
    }
    if (workedOverlaps(emp.id, workedStart, workedEnd)) {
      notify(`${emp.name} already worked during those hours`);
      return;
    }
    const h = scheduledHours(workedStart, workedEnd);
    if (!(h > 0) || h > 24) {
      notify("Couldn't read those times");
      return;
    }
    setBusy(true);
    const error = await insertWorked(
      emp.id,
      h,
      workedStart,
      workedEnd,
      note.trim() || null,
    );
    if (error) notify(`Couldn't add shift: ${error.message}`);
    else {
      await onChange();
      setEmpId("");
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

  /** Minutes since midnight; as an END time, "00:00" means midnight (1440). */
  function timeToMin(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  }
  function endToMin(t: string): number {
    const v = timeToMin(t);
    return v === 0 ? 24 * 60 : v;
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
    // Multiple blocks per day are fine (prep + evening); overlapping ones
    // are always a mistake.
    const overlaps = scheduled.some(
      (x) =>
        x.employee_id === emp.id &&
        timeToMin(schedStart) < endToMin(x.end_time) &&
        endToMin(schedEnd) > timeToMin(x.start_time),
    );
    if (overlaps) {
      notify(`${emp.name} is already scheduled during those hours`);
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
          ? `${emp.name} already has a shift starting at that time`
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

  /** "17:00"/"22:00" -> 5; end of "00:00" means midnight. */
  function scheduledHours(start: string, end: string): number {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const startMin = toMin(start);
    const endMin = toMin(end) === 0 ? 24 * 60 : toMin(end);
    return Math.round(((endMin - startMin) / 60) * 100) / 100;
  }

  // Convert a scheduled shift into a worked shift: the exact times carry
  // over, hours derive from them, rate snapshots from the employee, and the
  // schedule row is removed. Multiple blocks become multiple worked shifts.
  async function markWorked(s: ScheduledShift) {
    const emp = empById.get(s.employee_id);
    const hours = scheduledHours(s.start_time, s.end_time);
    if (!(hours > 0) || hours > 24) {
      notify("Couldn't read the scheduled times");
      return;
    }
    const start = s.start_time.slice(0, 5);
    const end = s.end_time.slice(0, 5);
    if (workedOverlaps(s.employee_id, start, end)) {
      notify(
        `${emp?.name ?? "Employee"} already has a worked shift during those hours`,
      );
      return;
    }
    setBusy(true);
    const error = await insertWorked(s.employee_id, hours, start, end, null);
    if (error) {
      notify(`Couldn't log shift: ${error.message}`);
    } else {
      await supabase.from("schedule").delete().eq("id", s.id);
      await onChange();
      notify(
        `${emp?.name ?? "Employee"}: ${fmtTimeChip(start, end)} (${hours}h) moved to worked`,
      );
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
                    {s.start_time && s.end_time ? (
                      <span className="shrink-0 text-xs text-muted">
                        {fmtTime(s.start_time)}–{fmtTime(s.end_time)}{" "}
                        <span className="font-semibold text-charcoal">
                          {Number(s.hours)}h
                        </span>
                      </span>
                    ) : (
                      <>
                        <input
                          // Re-key on the stored value so an external update
                          // re-syncs this uncontrolled field's display.
                          key={`${s.id}-${Number(s.hours)}`}
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
                      </>
                    )}
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
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={workedStart}
                  onChange={(e) => setWorkedStart(e.target.value)}
                  aria-label="Worked start time"
                  className={`${inputCls} flex-1`}
                />
                <span className="text-xs text-muted">to</span>
                <input
                  type="time"
                  value={workedEnd}
                  onChange={(e) => setWorkedEnd(e.target.value)}
                  aria-label="Worked end time"
                  className={`${inputCls} flex-1`}
                />
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
                disabled={busy || !empId}
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
                          onClick={() => markWorked(s)}
                          aria-label={`Mark ${emp?.name ?? "employee"} as worked`}
                          title="Move to worked"
                          className="flex h-7 w-7 shrink-0 items-center justify-center border border-charcoal/20 text-muted transition hover:border-[#5a7d4f] hover:text-[#5a7d4f] disabled:opacity-40"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3 w-3" aria-hidden="true">
                            <path d="M3 8.5l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
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
                // Anyone active can be scheduled again — a person may have a
                // morning prep block and an evening shift the same day.
                const schedulable = employees.filter((e) => e.active);
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
      </div>
    </Modal>
  );
}
