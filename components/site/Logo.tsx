/** Знак Horsteppe — тот же, что в продукте. Цвета берутся из текста вокруг. */
export function LogoMark({ className = "h-8 w-8", inverted = false }: { className?: string; inverted?: boolean }) {
  const bg = inverted ? "var(--color-cream)" : "var(--color-ink)";
  const fg = inverted ? "var(--color-forest)" : "var(--color-paper)";
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="24" fill={bg} />
      <g transform="translate(9 8) scale(0.82)">
        <g fill={fg}>
          <path d="M52 19C36 8 16 6 2 14c13 3 26 8 35 15C24 28 9 34 1 45c14-3 28 0 37 5C26 54 13 61 6 72c13-9 26-14 35-16 0-13 3-26 10-37z" />
          <path d="M60 18L51 3l16 9z" />
          <path d="M68 15L68 1l9 13z" />
          <path d="M62 16c10 1 17 8 20 17 4 9 10 19 13 27 2 4 0 8-4 8-4 0-7-2-10-5-3-3-8-4-13-3-7 1-13 6-17 13-3 6-5 13-6 20-6-8-10-19-10-30 0-16 6-35 18-44 3-2 6-3 9-3z" />
          <path d="M5 58c16-4 34 4 45 19 5 7 6 13 3 19-8 1-16-3-24-9C18 78 7 68 5 58z" />
        </g>
        <path d="M53 92c5 4 11 6 18 7" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" />
        <g fill="none" stroke={bg} strokeWidth="1.4" strokeLinecap="round" opacity="0.9">
          <path d="M43 26C31 21 17 22 7 27" />
          <path d="M42 45C30 41 16 42 6 48" />
          <path d="M8 60L53 92" />
        </g>
        <circle cx="74" cy="33" r="2.3" fill={bg} />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-display text-[19px] font-bold tracking-[-0.02em] ${className}`}>Horsteppe</span>;
}
