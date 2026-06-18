"use client";

import { useEffect, useRef } from "react";

/**
 * Subtle shooting stars that streak across the background. Passes cycle
 * through three vertical bands — upper, middle, and lower — so the stars
 * feel spread across the page rather than clustered in one spot. Each pass
 * randomizes origin, angle, length, and speed so it never feels mechanical.
 * Honors prefers-reduced-motion.
 */
export function ShootingStars() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Vertical bands (as fractions of the viewport height) that successive
    // stars step through, so consecutive passes stay spatially spaced out.
    const bands = [
      [0.04, 0.2], // upper
      [0.4, 0.54], // middle
      [0.66, 0.82], // lower
    ];
    let bandIndex = Math.floor(Math.random() * bands.length);

    let nextTimeout: number;

    const spawn = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const [bandMin, bandMax] = bands[bandIndex];
      bandIndex = (bandIndex + 1) % bands.length;

      const star = document.createElement("span");
      star.className = "shooting-star";

      const angle = 16 + Math.random() * 16; // gentle downward slope, 16–32°
      const travel = vw * (0.55 + Math.random() * 0.4);
      const duration = 1100 + Math.random() * 700;

      star.style.left = `${vw * (0.04 + Math.random() * 0.5)}px`;
      star.style.top = `${vh * (bandMin + Math.random() * (bandMax - bandMin))}px`;
      star.style.setProperty("--angle", `${angle}deg`);
      star.style.setProperty("--travel", `${travel}px`);
      star.style.setProperty("--duration", `${duration}ms`);

      star.addEventListener("animationend", () => star.remove());
      layer.appendChild(star);
    };

    const schedule = () => {
      const delay = 14000 + Math.random() * 10000; // ~14–24s between passes
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
