import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { itemLink, type FolderItem } from '@/lib/folders'

export function Poster({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="grid size-full place-items-center bg-gradient-to-br from-muted to-card p-2 text-center text-xs font-medium text-muted-foreground">
        {title}
      </div>
    )
  }
  return <img src={src} alt={title} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
}

type Props = { item: FolderItem; badge?: ReactNode; action?: ReactNode }

export function PosterCard({ item, badge, action }: Props) {
  return (
    <div className="group relative">
      <Link to={itemLink(item)} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted shadow-md ring-1 ring-white/5 transition duration-300 group-hover:ring-primary/60">
          <div className="size-full transition duration-500 group-hover:scale-105">
            <Poster src={item.poster} title={item.title} />
          </div>
          {badge && <div className="absolute bottom-1.5 left-1.5">{badge}</div>}
        </div>
        <p className="mt-1.5 truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.year ?? ' '}</p>
      </Link>
      {action && <div className="absolute top-1.5 right-1.5">{action}</div>}
    </div>
  )
}

export function PosterGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">{children}</div>
  )
}

export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <PosterGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3] rounded-lg" />
          <Skeleton className="mt-2 h-3.5 w-3/4" />
        </div>
      ))}
    </PosterGrid>
  )
}

/** Calls onVisible when scrolled near the end of a list. */
export function LoadMore({ onVisible, enabled }: { onVisible: () => void; enabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!enabled || !ref.current) return
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onVisible(), {
      rootMargin: '800px',
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [enabled, onVisible])
  return <div ref={ref} className="h-8" />
}
