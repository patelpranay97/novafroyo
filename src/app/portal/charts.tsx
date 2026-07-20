"use client";

import { useState } from "react";
import { fmtMoney } from "@/lib/portal";

/**
 * Grouped column chart built from divs (responsive, crisp at 375px).
 * Marks: ≤24px thick, 4px rounded data-end, square baseline, 2px surface
 * gaps; hairline baseline; values wear ink, never the series color.
 * Tap/hover a group → detail line below the plot (the tooltip layer).
 */
export function ColumnChart({
  groups,
  colors,
  detail,
  ariaLabel,
  fmtValue = fmtMoney,
}: {
  groups: { label: string; values: number[] }[];
  colors: string[];
  detail: (i: number) => string;
  ariaLabel: string;
  fmtValue?: (v: number) => string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  // Data can be refetched under a mounted chart (token refresh, edits from
  // another device); a remembered index past the new length must not crash.
  const validSel = sel !== null && sel < groups.length ? sel : null;
  const max = Math.max(...groups.flatMap((g) => g.values), 0);
  const maxGroup = groups.reduce(
    (best, g, i) =>
      Math.max(...g.values) > Math.max(...(groups[best]?.values ?? [0]))
        ? i
        : best,
    0,
  );
  const H = 112; // plot height px
  if (max <= 0) return null;
  return (
    <div role="img" aria-label={ariaLabel}>
      <p className="mb-1 text-[9px] text-muted/70">{fmtValue(max)} max</p>
      <div className="flex items-end gap-1 border-b border-charcoal/15">
        {groups.map((g, i) => (
          <button
            key={g.label + i}
            type="button"
            onClick={() => setSel(validSel === i ? null : i)}
            aria-label={detail(i)}
            className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-0"
            style={{ height: H + 16 }}
          >
            {i === maxGroup && (
              <span className="mb-0.5 text-[9px] font-semibold text-charcoal">
                {fmtValue(Math.max(...g.values))}
              </span>
            )}
            <span className="flex w-full items-end justify-center gap-[2px]">
              {g.values.map((v, j) => (
                <span
                  key={j}
                  className="block max-w-6 flex-1 rounded-t-[4px] transition-opacity"
                  style={{
                    height: Math.max(v > 0 ? 3 : 0, (v / max) * H),
                    background: colors[j],
                    opacity: validSel === null || validSel === i ? 1 : 0.35,
                  }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {groups.map((g, i) => (
          <span
            key={g.label + i}
            className={`min-w-0 flex-1 text-center text-[9px] ${
              validSel === i ? "font-bold text-charcoal" : "text-muted"
            }`}
          >
            {g.label}
          </span>
        ))}
      </div>
      <p className="mt-2 min-h-4 text-center text-[11px] text-charcoal">
        {validSel !== null ? detail(validSel) : ""}
      </p>
    </div>
  );
}
