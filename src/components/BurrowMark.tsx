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

/** Two solid ears that peek out from behind an element; place inside a relative parent, behind the content. */
export function PeekingEars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={className} aria-hidden fill="color-mix(in oklch, var(--primary) 22%, var(--card))">
      <path d="M18 52C13 40 9.5 24 12 3c5.5 8 7.5 24 7.5 49Z" />
      <path d="M22 52c5-12 8.5-28 6-49c-5.5 8-7.5 24-7.5 49Z" />
    </svg>
  )
}
