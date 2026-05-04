type Props = {
  className?: string;
};

export function Flourish({ className }: Props) {
  return (
    <svg
      viewBox="0 0 220 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 16 C 30 4, 60 22, 96 11 S 152 22, 178 9 C 192 3, 208 12, 214 14" />
    </svg>
  );
}
