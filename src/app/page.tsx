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
    <div className="overflow-hidden border-y border-charcoal/15 bg-cream-soft py-5">
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
      <header className="flex items-center justify-between px-6 py-6 sm:px-12 sm:py-8">
        <a
          href="/"
          aria-label="Nova — home"
          className="font-display text-sm tracking-[0.4em] text-charcoal"
        >
          NOVA
        </a>
        <nav className="flex items-center gap-6 text-[10px] font-semibold uppercase tracking-[0.3em]">
          <a
            href="https://www.instagram.com/novafroyo"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-aegean"
          >
            Instagram
          </a>
          <a
            href="https://www.tiktok.com/@novagreek"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-aegean"
          >
            TikTok
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="grain relative flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-12 text-center sm:px-12 sm:pb-32">
        {/* Floating sparkles */}
        <StarIcon className="twinkle absolute left-[12%] top-[18%] h-5 w-5 text-charcoal sm:left-[18%] sm:top-[22%] sm:h-7 sm:w-7" />
        <StarIcon className="twinkle twinkle-slow absolute right-[10%] top-[30%] h-4 w-4 text-charcoal sm:right-[16%] sm:top-[34%] sm:h-6 sm:w-6" />
        <StarIcon className="twinkle absolute bottom-[14%] right-[14%] h-3 w-3 text-charcoal sm:bottom-[18%] sm:right-[20%] sm:h-5 sm:w-5" />

        <p className="rise mb-10 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
          West Loop · Chicago · Est. 2026
        </p>

        <h1 className="rise rise-delay-1 font-display text-[clamp(5rem,22vw,18rem)] leading-[0.85] tracking-[-0.01em] text-charcoal">
          NOVA
        </h1>

        <p className="rise rise-delay-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.6em] text-charcoal sm:text-xs">
          Greek Frozen Yogurt
        </p>

        <div className="rise rise-delay-3 my-10 flex items-center gap-6">
          <span className="h-px w-12 bg-charcoal/30" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="h-48 w-auto sm:h-64"
          />
          <span className="h-px w-12 bg-charcoal/30" />
        </div>

        <h2 className="rise rise-delay-3 font-script text-[3.375rem] font-semibold leading-none text-aegean sm:text-[5.4rem]">
          Swirling Soon
        </h2>

        <p className="rise rise-delay-3 mt-8 max-w-md text-base leading-[1.6] text-charcoal/80 sm:text-[17px]">
          A new star is rising in the West Loop. Tangy, thick, and{" "}
          <span className="font-semibold text-aegean">very, very Greek</span>.
        </p>
      </section>

      {/* Marquee */}
      <Marquee />

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
