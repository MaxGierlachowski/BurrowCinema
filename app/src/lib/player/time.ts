const pad = (n: number) => String(n).padStart(2, '0')

/** Player time: 4:05, 1:02:03. */
export function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Wall clock time: 21:07. */
export const formatClock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const ignore = () => undefined
