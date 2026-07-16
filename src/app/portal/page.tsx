"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { Employee, Shift, TipDay } from "@/lib/portal";
import { Login, SetupNotice } from "./login";
import { Toast } from "./ui";
import { WeekView } from "./week-view";
import { CalendarView } from "./calendar-view";
import { TeamView } from "./team-view";

type Tab = "week" | "calendar" | "team";

const TABS: { id: Tab; label: string }[] = [
  { id: "week", label: "This Week" },
  { id: "calendar", label: "Calendar" },
  { id: "team", label: "Team" },
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
    const [emp, shf, tps] = await Promise.all([
      supabase.from("employees").select("*").order("name"),
      supabase.from("shifts").select("*").order("work_date"),
      supabase.from("tips").select("*").order("work_date"),
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
      <nav className="sticky top-0 z-40 flex border-b border-charcoal/10 bg-cream">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-3 text-[10px] font-semibold uppercase tracking-[0.3em] transition sm:text-[11px] ${
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
          </>
        )}
      </main>

      {toast && <Toast message={toast} />}
    </div>
  );
}
