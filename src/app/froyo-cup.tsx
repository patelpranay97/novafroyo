type Props = {
  className?: string;
};

/**
 * Hand-holding-froyo line mark — a vector recreation of the soft-serve cup
 * cradled in a hand. Drawn with currentColor strokes so it inherits the
 * charcoal palette and scales crisply at any size.
 */
export function FroyoCup({ className }: Props) {
  return (
    <svg
      viewBox="0 0 340 700"
      fill="none"
      stroke="currentColor"
      strokeWidth={9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Soft-serve swirl silhouette */}
      <path d="M64 232 C52 168 84 134 120 116 C140 106 150 80 176 58 C190 46 206 36 214 48 C222 60 206 78 197 90 C232 102 270 132 286 184 C295 214 290 228 282 234" />
      {/* Swirl folds */}
      <path d="M150 116 C175 100 205 104 218 124" />
      <path d="M92 172 C150 146 222 154 252 182" />
      {/* Cup rim */}
      <path d="M58 232 C120 256 224 256 286 232" />
      {/* Cup body */}
      <path d="M66 240 C72 300 92 350 104 392" />
      <path d="M280 240 C272 300 258 350 246 392" />
      {/* Hand — thumb + wrist (left) and back of hand (right) */}
      <path d="M104 392 C78 402 60 402 54 416 C46 434 72 452 80 482 C92 528 70 582 76 692" />
      <path d="M246 392 C284 408 306 432 306 462 C306 500 286 520 270 542 C236 588 214 632 208 692" />
      {/* Fingers wrapping the cup */}
      <path d="M158 532 C205 512 252 480 296 456" />
      <path d="M172 566 C216 546 258 516 296 492" />
      <path d="M188 598 C228 580 266 552 300 526" />
    </svg>
  );
}
