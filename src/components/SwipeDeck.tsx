import { Heart, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DrawItem } from '@shared/draws'
import { cn } from '@/lib/utils'
import { Poster } from './PosterCard'

const THRESHOLD = 100
const LEAVE_MS = 220

type Props = {
  items: DrawItem[]
  onSwipe: (item: DrawItem, like: boolean) => void
  onUndo: () => void
  canUndo: boolean
}

function Card({ item }: { item: DrawItem }) {
  return (
    <div className="relative size-full overflow-hidden rounded-2xl bg-muted shadow-2xl ring-1 ring-white/10">
      <div className="pointer-events-none size-full select-none">
        <Poster src={item.poster} title={item.title} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-16">
        <p className="text-xl leading-tight font-bold text-white">{item.title}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-white/75">
          {[item.year, item.type === 'series' ? 'Serie' : 'Film', item.rating && `★ ${item.rating.toFixed(1)}`].filter(Boolean).join(' · ')}
          {item.source !== 'jellyfin' && <Badge variant="secondary" className="bg-white/15 text-white">Nicht geladen</Badge>}
        </p>
      </div>
    </div>
  )
}

export function SwipeDeck({ items, onSwipe, onUndo, canUndo }: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState<boolean | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [top, next] = items

  const decide = (like: boolean) => {
    if (!top || leaving !== null) return
    setLeaving(like)
    setTimeout(() => {
      onSwipe(top, like)
      setLeaving(null)
      setOffset({ x: 0, y: 0 })
    }, LEAVE_MS)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') decide(true)
      if (e.key === 'ArrowLeft') decide(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current) setOffset({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })
  }
  const onPointerUp = () => {
    start.current = null
    setDragging(false)
    if (Math.abs(offset.x) > THRESHOLD) decide(offset.x > 0)
    else setOffset({ x: 0, y: 0 })
  }

  const x = leaving === null ? offset.x : (leaving ? 1 : -1) * window.innerWidth
  const likeOpacity = leaving === true ? 1 : Math.max(0, Math.min(1, offset.x / THRESHOLD))
  const nopeOpacity = leaving === false ? 1 : Math.max(0, Math.min(1, -offset.x / THRESHOLD))

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Card height is whatever is left of the screen after header, progress, buttons and navigation. */}
      <div
        className="relative aspect-[2/3]"
        style={{ width: 'min(100%, max(12rem, calc((100dvh - 21rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)) * 2 / 3)))' }}
      >
        {next && (
          <div className="absolute inset-0 scale-95 opacity-60 transition-transform">
            <Card item={next} />
          </div>
        )}
        {top && (
          <div
            key={top.key}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn('absolute inset-0 touch-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
            style={{
              transform: `translate(${x}px, ${leaving === null ? offset.y : offset.y + 40}px) rotate(${x / 18}deg)`,
              transition: dragging ? 'none' : `transform ${LEAVE_MS}ms ease-out`,
            }}
          >
            <Card item={top} />
            <span
              className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-lg border-2 border-emerald-400 px-3 py-1 text-lg font-bold tracking-wide text-emerald-400"
              style={{ opacity: likeOpacity }}
            >
              WILL ICH
            </span>
            <span
              className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-lg border-2 border-destructive px-3 py-1 text-lg font-bold tracking-wide text-destructive"
              style={{ opacity: nopeOpacity }}
            >
              NÖ
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-5">
        <Button
          size="icon"
          variant="secondary"
          aria-label="Gerade nicht"
          onClick={() => decide(false)}
          className="size-14 rounded-full text-destructive [&_svg:not([class*='size-'])]:size-6"
        >
          <X />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Rückgängig" disabled={!canUndo} onClick={onUndo} className="size-11 rounded-full">
          <Undo2 />
        </Button>
        <Button
          size="icon"
          aria-label="Will ich sehen"
          onClick={() => decide(true)}
          className="size-14 rounded-full [&_svg:not([class*='size-'])]:size-6"
        >
          <Heart className="fill-current" />
        </Button>
      </div>
    </div>
  )
}
