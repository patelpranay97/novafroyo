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
    <div className="overflow-hidden border-y border-charcoal/25 bg-cream-soft py-3">
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
    <div className="flex min-h-screen flex-col bg-cream text-charcoal">
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
      <section className="grain relative flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-12 text-center sm:px-12 sm:pb-32">
        {/* Sparkles — 2 charcoal anchors + 1 Aegean accent */}
        <StarIcon className="twinkle absolute left-[6%] top-[12%] h-2.5 w-2.5 text-charcoal sm:left-[16%] sm:top-[20%] sm:h-6 sm:w-6" />
        <StarIcon className="twinkle twinkle-slow absolute right-[6%] top-[26%] h-3.5 w-3.5 text-aegean sm:right-[18%] sm:top-[38%] sm:h-8 sm:w-8" />
        <StarIcon className="twinkle absolute bottom-[10%] right-[7%] h-2 w-2 text-charcoal sm:bottom-[22%] sm:right-[22%] sm:h-5 sm:w-5" />

        <p className="rise mb-10 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
          West Loop · Chicago
        </p>

        <h1 className="rise rise-delay-1 font-display text-[clamp(5rem,22vw,18rem)] leading-[0.85] tracking-[-0.01em] text-charcoal">
          NOVA
        </h1>

        <p className="rise rise-delay-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.6em] text-charcoal sm:text-xs">
          Greek Frozen Yogurt
        </p>

        <div className="rise rise-delay-3 my-10 flex items-center gap-6">
          <span className="h-px w-20 bg-charcoal/30" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="h-48 w-auto sm:h-64"
          />
          <span className="h-px w-20 bg-charcoal/30" />
        </div>

        <h2 className="rise rise-delay-3 font-script text-[3.375rem] font-semibold leading-none text-charcoal sm:text-[5.4rem]">
          Swirling Soon
        </h2>

        <p className="rise rise-delay-3 mt-8 max-w-md text-base leading-[1.6] text-charcoal/80 sm:text-[17px]">
          A new star is rising in the West Loop. Tangy, thick, and{" "}
          <span className="font-semibold text-charcoal">very, very Greek</span>.
        </p>
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
          <span className="flex items-center gap-6">
            <a
              href="https://www.instagram.com/novafroyo"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-aegean"
            >
              @novafroyo
            </a>
            <a
              href="https://www.tiktok.com/@novagreek"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-aegean"
            >
              @novagreek
            </a>
          </span>
          <span>© {new Date().getFullYear()} Nova Greek Frozen Yogurt</span>
        </div>
      </footer>
    </div>
  );
}
