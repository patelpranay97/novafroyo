"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPLOYEE_COLORS,
  type Employee,
  type Shift,
  fmtMoney,
  sumPay,
} from "@/lib/portal";
import { Card, Modal, SectionLabel, btnCls, btnSolidCls, inputCls } from "./ui";

type Props = {
  supabase: SupabaseClient;
  employees: Employee[];
  shifts: Shift[];
  onChange: () => Promise<void>;
  notify: (msg: string) => void;
};

export function TeamView({
  supabase,
  employees,
  shifts,
  onChange,
  notify,
}: Props) {
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [color, setColor] = useState(EMPLOYEE_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);

  const unpaidByEmp = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees) {
      map.set(
        e.id,
        sumPay(shifts.filter((s) => s.employee_id === e.id && !s.paid_at)),
      );
    }
    return map;
  }, [employees, shifts]);

  const sorted = useMemo(
    () =>
      [...employees].sort((a, b) =>
        a.active === b.active
          ? a.name.localeCompare(b.name)
          : a.active
            ? -1
            : 1,
      ),
    [employees],
  );

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    const r = Number(rate);
    if (!name.trim() || !Number.isFinite(r) || r < 0) {
      notify("Name and a valid hourly rate are required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("employees").insert({
      name: name.trim(),
      hourly_rate: r,
      color,
    });
    if (error) notify(`Couldn't add: ${error.message}`);
    else {
      await onChange();
      notify(`${name.trim()} added`);
      setName("");
      setRate("");
      setColor(
        EMPLOYEE_COLORS[(employees.length + 1) % EMPLOYEE_COLORS.length],
      );
    }
    setBusy(false);
  }

  async function updateRate(emp: Employee, input: HTMLInputElement) {
    const raw = input.value.trim();
    const r = Number(raw);
    const original = Number(emp.hourly_rate);
    // A blank or invalid field must NOT write $0 — revert the display instead.
    if (raw === "" || !Number.isFinite(r) || r < 0) {
      input.value = String(original);
      if (raw !== "") notify("Enter an hourly rate of $0 or more");
      return;
    }
    if (r === original) return;
    const { error } = await supabase
      .from("employees")
      .update({ hourly_rate: r })
      .eq("id", emp.id);
    if (error) {
      notify(`Couldn't update rate: ${error.message}`);
      input.value = String(original);
    } else {
      await onChange();
      notify(`${emp.name}'s rate is now ${fmtMoney(r)}/hr for new shifts`);
    }
  }

  async function toggleActive(emp: Employee) {
    const { error } = await supabase
      .from("employees")
      .update({ active: !emp.active })
      .eq("id", emp.id);
    if (error) notify(`Couldn't update: ${error.message}`);
    else await onChange();
  }

  async function deleteEmployee(emp: Employee) {
    setBusy(true);
    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", emp.id);
    if (error) notify(`Couldn't delete: ${error.message}`);
    else {
      await onChange();
      notify(`${emp.name} deleted`);
    }
    setBusy(false);
    setConfirmDelete(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Add employee */}
      <Card>
        <SectionLabel>Add someone new</SectionLabel>
        <form onSubmit={addEmployee} className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Name"
              className={`${inputCls} flex-1`}
            />
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0"
                placeholder="Rate/hr"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                aria-label="Hourly rate"
                className={`${inputCls} pl-7`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {EMPLOYEE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`h-6 w-6 rounded-full transition ${
                    color === c
                      ? "ring-2 ring-charcoal ring-offset-2 ring-offset-cream-soft"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={busy || !name.trim() || !rate}
              className={`${btnSolidCls} ml-auto`}
            >
              Add
            </button>
          </div>
        </form>
      </Card>

      {/* Employee list */}
      {sorted.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-muted">
            No employees yet — add your first one above.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((emp) => {
            const unpaid = unpaidByEmp.get(emp.id) ?? 0;
            return (
              <Card
                key={emp.id}
                className={emp.active ? "" : "opacity-55"}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: emp.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base tracking-[0.06em]">
                      {emp.name}
                      {!emp.active && (
                        <span className="ml-2 text-[9px] font-sans font-semibold uppercase tracking-[0.2em] text-muted">
                          Inactive
                        </span>
                      )}
                    </p>
                    {unpaid > 0 && (
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a04a4a]">
                        {fmtMoney(unpaid)} unpaid
                      </p>
                    )}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      min="0"
                      defaultValue={Number(emp.hourly_rate)}
                      onBlur={(e) => updateRate(emp, e.target)}
                      aria-label={`Hourly rate for ${emp.name}`}
                      className="w-24 border border-charcoal/25 bg-cream py-1.5 pl-6 pr-2 text-right text-sm outline-none focus:border-charcoal"
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    /hr
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(emp)}
                    className="border border-charcoal/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted transition hover:border-charcoal hover:text-charcoal"
                  >
                    {emp.active ? "Deactivate" : "Reactivate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(emp)}
                    className="border border-charcoal/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted transition hover:border-[#a04a4a] hover:text-[#a04a4a]"
                  >
                    Delete
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] leading-relaxed text-muted/80">
        Deactivate someone who&apos;s left to keep their history.
        <br />
        Delete only removes them <em>and every shift they ever worked</em>.
      </p>

      {confirmDelete && (
        <Modal
          title={`Delete ${confirmDelete.name}?`}
          onClose={() => setConfirmDelete(null)}
        >
          <p className="text-sm leading-relaxed text-muted">
            This permanently removes {confirmDelete.name} <em>and all of their
            logged shifts</em>, including{" "}
            {fmtMoney(unpaidByEmp.get(confirmDelete.id) ?? 0)} in unpaid work.
            If they just stopped working here, use Deactivate instead.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className={`${btnCls} flex-1`}
            >
              Keep
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => deleteEmployee(confirmDelete)}
              className="flex-1 border border-[#a04a4a] bg-[#a04a4a] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-cream transition hover:opacity-85 disabled:opacity-40"
            >
              Delete forever
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
