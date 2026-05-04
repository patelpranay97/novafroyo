type Props = {
  className?: string;
  title?: string;
};

export function SwirlIcon({ className, title }: Props) {
  return (
    <svg
      viewBox="0 0 100 140"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* Cup */}
      <path d="M28 80 L33 130 Q33 135 38 135 L62 135 Q67 135 67 130 L72 80 Z" />
      <line x1="28" y1="80" x2="72" y2="80" />
      {/* Soft-serve swirl, rising and tightening to a peak */}
      <path d="M30 80 Q42 70 50 76 Q58 82 70 80" />
      <path d="M32 72 Q44 62 52 68 Q60 74 68 72" />
      <path d="M35 64 Q46 54 54 60 Q62 66 65 64" />
      <path d="M38 55 Q48 46 56 52 Q62 56 62 55" />
      <path d="M41 46 Q50 38 58 44" />
      <path d="M44 38 Q50 32 55 36" />
      {/* Peak */}
      <path d="M47 30 Q50 18 53 30" />
    </svg>
  );
}
