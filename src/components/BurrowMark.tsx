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
      <path d="M2.5 20.5h19" />
      <path d="M6.5 20.5a5.5 5.5 0 0 1 11 0" />
      <ellipse cx="9.4" cy="8.6" rx="1.6" ry="5" transform="rotate(-12 9.4 8.6)" />
      <ellipse cx="14.6" cy="8.6" rx="1.6" ry="5" transform="rotate(12 14.6 8.6)" />
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
