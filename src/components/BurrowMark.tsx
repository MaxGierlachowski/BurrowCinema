/** Brand mark: a rabbit peeking out of its burrow, drawn in the same line style as the lucide icons. */
export function BurrowMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2.5 20h19" />
      <path d="M7 20a5 5 0 0 1 10 0" />
      <path d="M10.2 15.2C9 12 8.6 7.6 9.4 3.8c1.4 2.8 2 6.6 2 11.2" />
      <path d="M13.8 15.2c1.2-3.2 1.6-7.6.8-11.4c-1.4 2.8-2 6.6-2 11.2" />
    </svg>
  )
}

/** Two ears that peek out from behind an element; place inside a relative parent, behind the content. */
export function PeekingEars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={className} aria-hidden>
      <g fill="var(--card)" stroke="color-mix(in oklch, var(--foreground) 10%, transparent)" strokeWidth={1}>
        <ellipse cx="13" cy="28" rx="5.5" ry="22" transform="rotate(-9 13 28)" />
        <ellipse cx="27" cy="28" rx="5.5" ry="22" transform="rotate(9 27 28)" />
      </g>
      <g fill="color-mix(in oklch, var(--primary) 14%, transparent)">
        <ellipse cx="13" cy="26" rx="2.2" ry="15" transform="rotate(-9 13 26)" />
        <ellipse cx="27" cy="26" rx="2.2" ry="15" transform="rotate(9 27 26)" />
      </g>
    </svg>
  )
}
