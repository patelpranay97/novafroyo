"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import {
  DEFAULT_SETTINGS,
  type DailySales,
  type Employee,
  type InventoryDay,
  type ScheduledShift,
  type Settings,
  type Shift,
  type TipDay,
} from "@/lib/portal";
import { Login, SetupNotice } from "./login";
import { Toast } from "./ui";
import { WeekView } from "./week-view";
import { CalendarView } from "./calendar-view";
import { TeamView } from "./team-view";
import { InsightsView } from "./insights-view";
import { ProfitView } from "./profit-view";
import { StockView } from "./stock-view";

type Tab = "week" | "calendar" | "profit" | "stock" | "team" | "insights";

const TABS: { id: Tab; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "calendar", label: "Calendar" },
  { id: "profit", label: "Profit" },
  { id: "stock", label: "Stock" },
  { id: "team", label: "Team" },
  { id: "insights", label: "Insights" },
];

export default function PortalPage() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null | undefined>(
    undefined,
  );
  const [tab, setTab] = useState<Tab>("week");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tips, setTips] = useState<TipDay[]>([]);
  const [schedule, setSchedule] = useState<ScheduledShift[]>([]);
  const [scheduleReady, setScheduleReady] = useState(true);
  const [sales, setSales] = useState<DailySales[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [salesReady, setSalesReady] = useState(true);
  const [inventory, setInventory] = useState<InventoryDay[]>([]);
  const [invReady, setInvReady] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const [emp, shf, tps, sch, sls, stg, inv] = await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.from("shifts").select("*").order("work_date"),
      supabase.from("tips").select("*").order("work_date"),
      supabase.from("schedule").select("*").order("work_date"),
      supabase.from("daily_sales").select("*").order("work_date"),
      supabase.from("settings").select("*").order("id"),
      supabase.from("inventory").select("*").order("work_date"),
    ]);
    const err = emp.error ?? shf.error ?? tps.error;
    if (err) {
      setLoadError(err.message);
      notify(`Couldn't load data: ${err.message}`);
      return;
    }
    setEmployees((emp.data as Employee[]) ?? []);
    setShifts((shf.data as Shift[]) ?? []);
    setTips((tps.data as TipDay[]) ?? []);
    // Scheduling is non-fatal: the table only exists after the one-time
    // migration in supabase/migration-scheduling.sql has been run.
    setSchedule(sch.error ? [] : ((sch.data as ScheduledShift[]) ?? []));
    setScheduleReady(!sch.error);
    // Daily sales/settings are non-fatal the same way (migration-daily-sales.sql).
    setSales(sls.error ? [] : ((sls.data as DailySales[]) ?? []));
    setSettings(
      stg.error ? DEFAULT_SETTINGS : ((stg.data?.[0] as Settings) ?? DEFAULT_SETTINGS),
    );
    setSalesReady(!sls.error && !stg.error);
    // Stock tracking is non-fatal the same way (migration-inventory.sql).
    setInventory(inv.error ? [] : ((inv.data as InventoryDay[]) ?? []));
    setInvReady(!inv.error);
    setLoadError(null);
    setLoaded(true);
  }, [supabase, notify]);

  useEffect(() => {
    // Initial data load after sign-in; refresh() only sets state after awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session) void refresh();
  }, [session, refresh]);

  if (!supabase) return <SetupNotice />;
  if (session === undefined) {
    return <div className="min-h-dvh bg-cream" aria-busy="true" />;
  }
  if (!session) return <Login supabase={supabase} />;

  return (
    <div className="min-h-dvh bg-cream text-charcoal">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-charcoal/10 px-5 py-4 sm:px-8">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="font-display text-sm tracking-[0.4em] text-charcoal"
          >
            NOVA
          </Link>
          <span className="text-[9px] font-semibold uppercase tracking-[0.4em] text-muted">
            Portal
          </span>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted transition hover:text-charcoal"
        >
          Sign out
        </button>
      </header>

      {/* Tabs */}
      <nav className="sticky top-0 z-40 flex justify-between border-b border-charcoal/10 bg-cream px-3 sm:justify-center sm:gap-10 sm:px-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-0.5 py-3 text-[9px] font-semibold uppercase tracking-[0.18em] transition sm:text-[11px] sm:tracking-[0.3em] ${
              tab === t.id
                ? "border-b-2 border-charcoal text-charcoal"
                : "border-b-2 border-transparent text-muted hover:text-charcoal"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-20 sm:px-6">
        {loadError && !loaded ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#a04a4a]">Couldn&apos;t load your data.</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                void refresh();
              }}
              className="mt-4 border border-charcoal/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-charcoal transition hover:bg-charcoal hover:text-cream"
            >
              Try again
            </button>
          </div>
        ) : !loaded ? (
          <p className="py-16 text-center text-[10px] font-semibold uppercase tracking-[0.4em] text-muted">
            Loading…
          </p>
        ) : (
          <>
            {tab === "week" && (
              <WeekView
                supabase={supabase}
                employees={employees}
                shifts={shifts}
                tips={tips}
                onChange={refresh}
                notify={notify}
              />
            )}
            {tab === "calendar" && (
              <CalendarView
                supabase={supabase}
                employees={employees}
                shifts={shifts}
                tips={tips}
                schedule={schedule}
                scheduleReady={scheduleReady}
                onChange={refresh}
                notify={notify}
              />
            )}
            {tab === "team" && (
              <TeamView
                supabase={supabase}
                employees={employees}
                shifts={shifts}
                onChange={refresh}
                notify={notify}
              />
            )}
            {tab === "profit" && (
              <ProfitView
                supabase={supabase}
                shifts={shifts}
                tips={tips}
                sales={sales}
                settings={settings}
                salesReady={salesReady}
                onChange={refresh}
                notify={notify}
              />
            )}
            {tab === "stock" && (
              <StockView
                supabase={supabase}
                inventory={inventory}
                invReady={invReady}
                onChange={refresh}
                notify={notify}
              />
            )}
            {tab === "insights" && (
              <InsightsView employees={employees} shifts={shifts} tips={tips} />
            )}
          </>
        )}
      </main>

      {toast && <Toast message={toast} />}
    </div>
  );
}
