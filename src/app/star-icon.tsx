type Props = {
  className?: string;
};

export function StarIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 0 C 20.5 14.5 25.5 19.5 40 20 C 25.5 20.5 20.5 25.5 20 40 C 19.5 25.5 14.5 20.5 0 20 C 14.5 19.5 19.5 14.5 20 0 Z" />
    </svg>
  );
}
