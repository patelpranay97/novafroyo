"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inputCls, btnSolidCls, SectionLabel } from "./ui";

export function Login({ supabase }: { supabase: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6">
      <p className="font-display text-3xl tracking-[0.3em] text-charcoal">
        NOVA
      </p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
        Owner Portal
      </p>
      <form
        onSubmit={signIn}
        className="mt-10 flex w-full max-w-xs flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Email</SectionLabel>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Password</SectionLabel>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </div>
        {error && (
          <p className="text-xs text-[#a04a4a]" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={btnSolidCls}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export function SetupNotice() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      <p className="font-display text-3xl tracking-[0.3em] text-charcoal">
        NOVA
      </p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
        Owner Portal
      </p>
      <p className="mt-8 max-w-sm text-sm leading-relaxed text-muted">
        The portal isn&apos;t connected to its database yet. Follow the steps
        in <span className="font-semibold text-charcoal">PORTAL_SETUP.md</span>{" "}
        (create the Supabase project, then add the two environment variables)
        and redeploy.
      </p>
    </div>
  );
}
