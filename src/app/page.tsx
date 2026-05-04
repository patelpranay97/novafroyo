import { NotifyForm } from "./notify-form";

const MARQUEE_ITEMS = [
  "Swirling Soon",
  "West Loop · Chicago",
  "Greek Frozen Yogurt",
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
            className="font-display text-base tracking-[0.35em] text-charcoal/80 sm:text-lg"
          >
            {item}
            <span className="ml-12 text-charcoal/30">✦</span>
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
        <span className="font-display text-sm tracking-[0.4em] text-charcoal">
          NOVA
        </span>
        <nav className="flex items-center gap-6 text-[10px] font-semibold uppercase tracking-[0.3em]">
          <a
            href="https://www.instagram.com/novafroyo"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-muted"
          >
            Instagram
          </a>
          <a
            href="https://www.tiktok.com/@novagreek"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-muted"
          >
            TikTok
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="grain relative flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-12 text-center sm:px-12 sm:pb-32">
        <p className="rise mb-10 text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
          West Loop · Chicago · Est. 2026
        </p>

        <h1 className="rise rise-delay-1 font-display text-[clamp(5rem,22vw,18rem)] leading-[0.85] tracking-[-0.01em] text-charcoal">
          NOVA
        </h1>

        <p className="rise rise-delay-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.6em] text-charcoal sm:text-xs">
          Greek Frozen Yogurt
        </p>

        <div className="my-14 h-px w-20 bg-charcoal/30" />

        <h2 className="rise rise-delay-3 font-display text-4xl tracking-[0.05em] text-charcoal sm:text-6xl">
          Swirling Soon.
        </h2>

        <p className="rise rise-delay-3 mt-10 max-w-xl text-base leading-[1.7] text-charcoal/75 sm:text-[17px]">
          We couldn&apos;t help but wonder… where did all the froyo go?{" "}
          <br className="hidden sm:block" />
          Nova is bringing it back — thicker, tangier, made the way the Greeks
          intended. Coming soon to the West Loop.
        </p>
      </section>

      {/* Marquee */}
      <Marquee />

      {/* Story / Notify */}
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-16 px-6 py-24 sm:px-12 sm:py-32 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.5em] text-muted">
            01 — The Idea
          </p>
          <h3 className="mt-6 font-display text-3xl leading-[1.1] tracking-tight text-charcoal sm:text-4xl">
            Frozen yogurt, the way it was meant to be.
          </h3>
        </div>
        <div className="space-y-6 text-base leading-[1.8] text-charcoal/80 sm:text-[17px] md:col-span-7">
          <p>
            Real Greek yogurt. Real cream. Real fruit. No shortcuts, no
            powders, no apologies. Nova is a love letter to the froyo we grew
            up with — and a small rebellion against everything that came after.
          </p>
          <p>
            We&apos;re opening our first shop in Chicago&apos;s West Loop.
            Think long counters, soft light, a wall of toppings, and the
            tangiest swirl in the city. Drop your email and we&apos;ll let you
            know the moment we open the doors.
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

        <div className="relative flex h-full flex-col items-center justify-center px-6 text-center sm:px-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.5em] text-cream/70">
            Coming 2026
          </p>
          <h3 className="mt-6 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-cream sm:text-6xl md:text-7xl">
            Greek-style froyo, Chicago-made.
          </h3>
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.5em] text-cream/70">
            West Loop
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-charcoal/10 bg-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 text-[10px] font-semibold uppercase tracking-[0.4em] text-muted sm:flex-row sm:px-12">
          <span className="font-display text-sm tracking-[0.4em] text-charcoal">
            NOVA
          </span>
          <span className="flex items-center gap-6">
            <a
              href="https://www.instagram.com/novafroyo"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-charcoal"
            >
              @novafroyo
            </a>
            <a
              href="https://www.tiktok.com/@novagreek"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-charcoal"
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
