export function formatRuntime(minutes?: number) {
  if (!minutes) return undefined
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h} Std. ${m} Min.` : `${m} Min.`
}

export const ticksToMinutes = (ticks?: number) => (ticks ? ticks / 600_000_000 : undefined)

export const formatRating = (rating?: number) => (rating ? `★ ${rating.toFixed(1)}` : undefined)

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
