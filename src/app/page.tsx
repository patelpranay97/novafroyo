import { NotifyForm } from "./notify-form";
import { SwirlIcon } from "./swirl-icon";
import { StarIcon } from "./star-icon";
import { Flourish } from "./flourish";

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
            <StarIcon className="h-4 w-4 text-aegean" />
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
        <span className="flex items-center gap-2.5">
          <SwirlIcon className="h-7 w-auto text-charcoal" />
          <span className="font-display text-sm tracking-[0.4em] text-charcoal">
            NOVA
          </span>
        </span>
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
        <StarIcon className="twinkle absolute left-[12%] top-[18%] h-5 w-5 text-aegean sm:left-[18%] sm:top-[22%] sm:h-7 sm:w-7" />
        <StarIcon className="twinkle twinkle-slow absolute right-[10%] top-[30%] h-4 w-4 text-aegean sm:right-[16%] sm:top-[34%] sm:h-6 sm:w-6" />
        <StarIcon className="twinkle absolute bottom-[14%] right-[14%] h-3 w-3 text-aegean sm:bottom-[18%] sm:right-[20%] sm:h-5 sm:w-5" />

        <p className="rise mb-10 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
          West Loop · Chicago · Est. 2026
        </p>

        <h1 className="rise rise-delay-1 font-display text-[clamp(5rem,22vw,18rem)] leading-[0.85] tracking-[-0.01em] text-charcoal">
          NOVA
        </h1>

        <p className="rise rise-delay-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.6em] text-charcoal sm:text-xs">
          Greek Frozen Yogurt
        </p>

        <div className="rise rise-delay-3 my-12 flex items-center gap-6">
          <span className="h-px w-12 bg-charcoal/30" />
          <SwirlIcon className="h-16 w-auto text-charcoal/80" />
          <span className="h-px w-12 bg-charcoal/30" />
        </div>

        <div className="relative">
          <h2 className="rise rise-delay-3 font-display text-4xl tracking-[0.05em] text-charcoal sm:text-6xl">
            Swirling Soon.
          </h2>
          <Flourish className="rise rise-delay-3 mx-auto mt-2 h-5 w-56 text-aegean sm:h-6 sm:w-72" />
        </div>

        <p className="rise rise-delay-3 mt-8 max-w-md text-base leading-[1.6] text-charcoal/80 sm:text-[17px]">
          A new star is rising in the West Loop. Tangy, thick, and{" "}
          <span className="font-semibold text-aegean">very, very Greek</span>.
        </p>
      </section>

      {/* Marquee */}
      <Marquee />

      {/* Story / Notify */}
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-16 px-6 py-24 sm:px-12 sm:py-32 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
            <StarIcon className="h-3 w-3 text-aegean" />
            01 — The Idea
          </p>
          <h3 className="mt-6 font-display text-3xl leading-[1.1] tracking-tight text-charcoal sm:text-4xl">
            Frozen yogurt, the way the gods intended.
          </h3>
        </div>
        <div className="space-y-6 text-base leading-[1.8] text-charcoal/80 sm:text-[17px] md:col-span-7">
          <p>
            Real Greek yogurt. Real cream. Real fruit. No shortcuts, no
            powders, no apologies — and a wall of toppings that&apos;d make
            Olympus jealous.
          </p>
          <p className="flex items-start gap-3 italic text-aegean">
            <StarIcon className="mt-1.5 h-3 w-3 flex-shrink-0" />
            <span>
              P.S. We&apos;re bringing the Greek. Chicago&apos;s bringing the
              Loop.
            </span>
          </p>
          <div className="pt-4">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
              Be the first to swirl with us
            </p>
            <NotifyForm />
          </div>
        </div>
      </section>

      {/* Skyline — full-bleed atmospheric closer */}
      <section className="relative h-[70vh] w-full overflow-hidden sm:h-[80vh]">
        <div
          className="skyline-duotone absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/chicago-skyline.jpg)" }}
        />
        <div className="absolute inset-0 bg-charcoal/45" />
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{ backgroundColor: "var(--cream)" }}
        />
        <div className="absolute inset-0 bg-charcoal/40" />

        {/* Sparkles in the sky */}
        <StarIcon className="twinkle absolute left-[14%] top-[18%] h-6 w-6 text-cream/70 sm:h-8 sm:w-8" />
        <StarIcon className="twinkle twinkle-slow absolute right-[18%] top-[24%] h-4 w-4 text-cream/60 sm:h-6 sm:w-6" />
        <StarIcon className="twinkle absolute right-[12%] top-[40%] h-5 w-5 text-cream/65 sm:h-7 sm:w-7" />

        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center sm:px-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.5em] text-cream/70">
            Coming 2026
          </p>
          <h3 className="mt-6 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-cream sm:text-6xl md:text-7xl">
            A new star, rising soon.
          </h3>
          <Flourish className="mx-auto mt-4 h-5 w-56 text-cream/70 sm:h-6 sm:w-72" />
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.5em] text-cream/70">
            West Loop · Chicago
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-charcoal/10 bg-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 text-[10px] font-semibold uppercase tracking-[0.4em] text-muted sm:flex-row sm:px-12">
          <span className="flex items-center gap-2.5">
            <SwirlIcon className="h-6 w-auto text-charcoal" />
            <span className="font-display text-sm tracking-[0.4em] text-charcoal">
              NOVA
            </span>
          </span>
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
