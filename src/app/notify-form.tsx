"use client";

import { useState, type FormEvent } from "react";

export function NotifyForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="font-display text-lg tracking-wide text-charcoal">
        Thank you — see you at the swirl.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 border-b border-charcoal/40 bg-transparent px-1 py-3 text-base placeholder:text-charcoal/40 focus:border-charcoal focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-full bg-charcoal px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition hover:bg-charcoal-soft"
      >
        Notify Me
      </button>
    </form>
  );
}
