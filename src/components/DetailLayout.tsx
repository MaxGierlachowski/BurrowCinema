import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Poster } from './PosterCard'

type Props = {
  title: string
  backdrop?: string
  poster?: string
  logo?: string
  meta: (string | undefined)[]
  genres?: string[]
  tagline?: string
  overview?: string
  badges?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

function BackButton() {
  const navigate = useNavigate()
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label="Zurück"
      onClick={() => navigate(-1)}
      className="absolute top-4 left-4 z-10 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60"
    >
      <ArrowLeft />
    </Button>
  )
}

export function DetailLayout(props: Props) {
  const { title, backdrop, poster, logo, meta, genres, tagline, overview, badges, actions, children } = props
  return (
    <div className="pb-10">
      <div className="relative h-[38vh] min-h-56 overflow-hidden md:h-[62vh]">
        {backdrop && <img src={backdrop} alt="" className="size-full object-cover object-top" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/0" />
        <div className="absolute inset-0 hidden bg-gradient-to-r from-background/90 via-background/30 to-transparent md:block" />
        <BackButton />
      </div>

      <div className="relative mx-auto -mt-28 grid max-w-6xl grid-cols-[7rem_1fr] gap-x-4 px-4 sm:grid-cols-[9rem_1fr] md:-mt-80 md:grid-cols-[15rem_1fr] md:gap-x-10">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-2xl ring-1 ring-white/10 md:row-span-2">
          <Poster src={poster} title={title} />
        </div>

        <div className="min-w-0 space-y-2 self-end md:self-auto md:pt-24">
          {logo ? (
            <img src={logo} alt={title} className="max-h-14 max-w-full object-contain object-left md:max-h-28" />
          ) : (
            <h1 className="text-2xl leading-tight font-bold tracking-tight text-balance md:text-5xl">{title}</h1>
          )}
          <p className="text-sm text-muted-foreground">{meta.filter(Boolean).join(' · ')}</p>
          {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
        </div>

        <div className="col-span-2 mt-6 space-y-5 md:col-span-1 md:col-start-2 md:max-w-3xl">
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          {!!genres?.length && (
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <Badge key={g} variant="outline">
                  {g}
                </Badge>
              ))}
            </div>
          )}
          {tagline && <p className="text-lg text-foreground/90 italic">{tagline}</p>}
          {overview && <p className="leading-relaxed text-muted-foreground">{overview}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">{children}</div>
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="pb-10">
      <Skeleton className="h-[38vh] min-h-56 rounded-none md:h-[62vh]" />
      <div className="mx-auto -mt-28 flex max-w-6xl gap-4 px-4 md:-mt-80">
        <Skeleton className="aspect-[2/3] w-28 rounded-xl sm:w-36 md:w-60" />
        <div className="flex-1 space-y-3 self-end">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">{children}</div>
    </section>
  )
}
