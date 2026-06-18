"use client";

import { useEffect, useRef } from "react";

/**
 * A very subtle shooting star that streaks across the background roughly
 * every ~30s. Each pass randomizes its origin, angle, length, and speed so
 * it never feels mechanical. Honors prefers-reduced-motion.
 */
export function ShootingStars() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let nextTimeout: number;

    const spawn = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const star = document.createElement("span");
      star.className = "shooting-star";

      const angle = 16 + Math.random() * 16; // gentle downward slope, 16–32°
      const travel = vw * (0.55 + Math.random() * 0.4);
      const duration = 1100 + Math.random() * 700;

      star.style.left = `${vw * (0.04 + Math.random() * 0.5)}px`;
      star.style.top = `${vh * (0.02 + Math.random() * 0.32)}px`;
      star.style.setProperty("--angle", `${angle}deg`);
      star.style.setProperty("--travel", `${travel}px`);
      star.style.setProperty("--duration", `${duration}ms`);

      star.addEventListener("animationend", () => star.remove());
      layer.appendChild(star);
    };

    const schedule = () => {
      const delay = 26000 + Math.random() * 12000; // ~26–38s between passes
      nextTimeout = window.setTimeout(() => {
        spawn();
        schedule();
      }, delay);
    };

    // First glimpse a few seconds in, then settle into the long cadence.
    const introTimeout = window.setTimeout(spawn, 4500);
    schedule();

    return () => {
      window.clearTimeout(introTimeout);
      window.clearTimeout(nextTimeout);
      layer.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    />
  );
}
