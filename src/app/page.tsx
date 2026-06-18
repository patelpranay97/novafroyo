import { ShootingStars } from "./shooting-stars";
import { StarIcon } from "./star-icon";

const MARQUEE_ITEMS = [
  "Swirling Soon",
  "A New Star in the West Loop",
  "Tangy. Thick. Greek.",
  "Est. 2026",
];

function Marquee() {
  const sequence = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="overflow-hidden border-y border-charcoal/25 bg-cream-soft py-1.5">
      <div className="marquee-track flex w-max items-center gap-12 whitespace-nowrap">
        {[...sequence, ...sequence].map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-12 font-display text-base tracking-[0.35em] text-charcoal/85 sm:text-lg"
          >
            {item}
            <StarIcon className="h-4 w-4 text-charcoal" />
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="isolate flex min-h-screen flex-col bg-cream text-charcoal">
      {/* Shooting star — rare, subtle background streak */}
      <ShootingStars />

      {/* Header */}
      <header className="flex items-center px-6 py-6 sm:px-12 sm:py-8">
        <a
          href="/"
          aria-label="Nova — home"
          className="font-display text-sm tracking-[0.4em] text-charcoal"
        >
          NOVA
        </a>
      </header>

      {/* Hero */}
      <section className="grain relative flex flex-1 flex-col items-center justify-center gap-12 px-6 pb-24 pt-12 text-center sm:gap-16 sm:px-12 sm:pb-32">
        {/* Sparkles — 2 charcoal anchors + 1 Aegean accent */}
        <StarIcon className="twinkle absolute left-[6%] top-[12%] h-2.5 w-2.5 text-charcoal sm:left-[16%] sm:top-[20%] sm:h-6 sm:w-6" />
        <StarIcon className="twinkle twinkle-slow absolute right-[6%] top-[26%] h-3.5 w-3.5 text-aegean sm:right-[18%] sm:top-[38%] sm:h-8 sm:w-8" />
        <StarIcon className="twinkle absolute bottom-[10%] right-[7%] h-2 w-2 text-charcoal sm:bottom-[22%] sm:right-[22%] sm:h-5 sm:w-5" />

        {/* Block 1 — Wordmark cluster */}
        <div className="flex flex-col items-center">
          <p className="rise mb-8 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
            West Loop · Chicago
          </p>
          <h1 className="rise rise-delay-1 font-display text-[clamp(4rem,18vw,14rem)] leading-[0.85] tracking-[-0.01em] text-charcoal">
            NOVA
          </h1>
          <p className="rise rise-delay-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.6em] text-charcoal sm:text-xs">
            Greek Frozen Yogurt
          </p>
        </div>

        {/* Block 3 — Cup logo seal */}
        <div className="rise rise-delay-3 flex items-center gap-6">
          <span className="h-px w-20 bg-charcoal/30" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/froyo-cup.svg"
            alt=""
            aria-hidden="true"
            className="h-[9.6rem] w-auto sm:h-[12.8rem]"
          />
          <span className="h-px w-20 bg-charcoal/30" />
        </div>

        {/* Block 4 — Tagline */}
        <div className="rise rise-delay-3 flex flex-col items-center gap-3">
          <p className="text-lg text-charcoal sm:text-xl">
            Clean. Simple. Tart.
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
            Frozen Yogurt Reimagined
          </p>
        </div>
      </section>

      {/* Aegean wave — owned brand signature */}
      <div className="aegean-wave" aria-hidden="true" />

      {/* Marquee */}
      <Marquee />

      {/* Phase chip — anticipation hook */}
      <div className="bg-cream py-8 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-muted">
          Opening Summer 2026 · West Loop, Chicago
        </p>
      </div>

      {/* Footer */}
      <footer className="border-t border-charcoal/10 bg-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-8 text-[10px] font-semibold uppercase tracking-[0.4em] text-muted sm:flex-row sm:px-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Nova Greek Frozen Yogurt"
            className="h-10 w-auto"
          />
          <span className="flex items-center gap-5">
            <a
              href="https://www.instagram.com/novafroyo/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Nova on Instagram"
              className="text-charcoal transition hover:text-charcoal/60"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path d="M12 2c-2.7 0-3.05.01-4.12.06-1.06.05-1.79.22-2.43.47-.66.26-1.22.6-1.77 1.16-.56.55-.9 1.11-1.16 1.77-.25.64-.42 1.37-.47 2.43C2.01 8.95 2 9.3 2 12s.01 3.05.06 4.12c.05 1.06.22 1.79.47 2.43.26.66.6 1.22 1.16 1.77.55.56 1.11.9 1.77 1.16.64.25 1.37.42 2.43.47C8.95 21.99 9.3 22 12 22s3.05-.01 4.12-.06c1.06-.05 1.79-.22 2.43-.47.66-.26 1.22-.6 1.77-1.16.56-.55.9-1.11 1.16-1.77.25-.64.42-1.37.47-2.43.05-1.07.06-1.42.06-4.12s-.01-3.05-.06-4.12c-.05-1.06-.22-1.79-.47-2.43-.26-.66-.6-1.22-1.16-1.77-.55-.56-1.11-.9-1.77-1.16-.64-.25-1.37-.42-2.43-.47C15.05 2.01 14.7 2 12 2zm0 1.8c2.67 0 2.98.01 4.04.06.97.04 1.5.21 1.85.35.47.18.8.4 1.15.75.35.35.57.68.75 1.15.14.35.31.88.35 1.85.05 1.06.06 1.37.06 4.04s-.01 2.98-.06 4.04c-.04.97-.21 1.5-.35 1.85-.18.47-.4.8-.75 1.15-.35.35-.68.57-1.15.75-.35.14-.88.31-1.85.35-1.06.05-1.37.06-4.04.06s-2.98-.01-4.04-.06c-.97-.04-1.5-.21-1.85-.35-.47-.18-.8-.4-1.15-.75-.35-.35-.57-.68-.75-1.15-.14-.35-.31-.88-.35-1.85-.05-1.06-.06-1.37-.06-4.04s.01-2.98.06-4.04c.04-.97.21-1.5.35-1.85.18-.47.4-.8.75-1.15.35-.35.68-.57 1.15-.75.35-.14.88-.31 1.85-.35C9.02 3.81 9.33 3.8 12 3.8zm0 3.06A5.14 5.14 0 1 0 12 17.14 5.14 5.14 0 0 0 12 6.86zm0 8.47A3.33 3.33 0 1 1 12 8.67a3.33 3.33 0 0 1 0 6.66zm6.54-8.67a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z" />
              </svg>
            </a>
            <a
              href="https://www.tiktok.com/@novafroyo"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Nova on TikTok"
              className="text-charcoal transition hover:text-charcoal/60"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.3v12.93a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-.69-5.08v-3.4a5.89 5.89 0 0 0-5.89 5.89A5.89 5.89 0 0 0 8.97 21.6a5.89 5.89 0 0 0 5.89-5.89V9.01a7.55 7.55 0 0 0 4.4 1.41V7.12a4.28 4.28 0 0 1-2.66-1.3z" />
              </svg>
            </a>
          </span>
          <span>© {new Date().getFullYear()} Nova Greek Frozen Yogurt</span>
        </div>
      </footer>
    </div>
  );
}
