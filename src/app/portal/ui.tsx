"use client";

// Small shared UI pieces for the portal, kept in Nova's visual language.

export const inputCls =
  "w-full rounded-none border border-charcoal/25 bg-cream-soft px-3 py-2 text-sm text-charcoal outline-none transition focus:border-charcoal placeholder:text-muted/60";

export const btnCls =
  "inline-flex items-center justify-center gap-2 border border-charcoal/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-charcoal transition hover:bg-charcoal hover:text-cream disabled:pointer-events-none disabled:opacity-40";

export const btnSolidCls =
  "inline-flex items-center justify-center gap-2 border border-charcoal bg-charcoal px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-cream transition hover:bg-charcoal-soft disabled:pointer-events-none disabled:opacity-40";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-muted">
      {children}
    </p>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-charcoal/15 bg-cream-soft p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto border border-charcoal/20 bg-cream p-5 sm:max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg tracking-[0.1em] text-charcoal">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center border border-charcoal/25 text-charcoal transition hover:bg-charcoal hover:text-cream"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 border border-charcoal bg-charcoal px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-cream">
      {message}
    </div>
  );
}
