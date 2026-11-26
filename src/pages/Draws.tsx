import { useQuery } from '@tanstack/react-query'
import { BarChart3, Plus, Server } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Page, PageHeader } from '@/components/AppShell'
import { BurrowMark } from '@/components/BurrowMark'
import { ProgressBar } from '@/components/DrawParts'
import { DrawServerDialog } from '@/components/DrawServerSetup'
import { EmptyState } from '@/components/EmptyState'
import { Poster } from '@/components/PosterCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@shared/hooks/useAuth'
import { describeStatus, getDrawServer, listDraws, TYPE_LABEL, type DrawStatus, type DrawSummary } from '@shared/draws'
import { plural } from '@shared/format'

const SECTIONS: { status: DrawStatus; title: string }[] = [
  { status: 'running', title: 'Laufend' },
  { status: 'scheduled', title: 'Geplant' },
  { status: 'ended', title: 'Beendet' },
]

function DrawCard({ draw, userId }: { draw: DrawSummary; userId: string }) {
  const mine = draw.participants.find((p) => p.id === userId)?.swiped ?? 0
  return (
    <Link to={`/draws/${draw.id}`} className="flex gap-4 rounded-xl border bg-card p-3 transition-colors hover:border-primary/50">
      <div className="relative h-24 w-20 shrink-0">
        {draw.posters.length === 0 && (
          <div className="grid size-full place-items-center rounded-lg bg-muted text-muted-foreground">
            <BurrowMark className="size-8" />
          </div>
        )}
        {draw.posters.map((src, i) => (
          <div
            key={src}
            className="absolute top-0 h-24 w-16 overflow-hidden rounded-md shadow-lg ring-1 ring-black/40"
            style={{ left: i * 6, transform: `rotate(${(i - 1) * 5}deg)`, zIndex: 3 - i }}
          >
            <Poster src={src} title="" />
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-1 self-center">
        <p className="truncate font-semibold">{draw.title}</p>
        <p className="text-sm text-muted-foreground">{describeStatus(draw)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {plural(draw.itemCount, 'Titel', 'Titel')} · {TYPE_LABEL[draw.itemType]} · {plural(draw.participants.length, 'Person', 'Personen')}
        </p>
        {draw.status === 'running' && <ProgressBar value={draw.itemCount ? mine / draw.itemCount : 0} className="mt-2" />}
      </div>
    </Link>
  )
}

export default function Draws() {
  const session = useSession()
  const [server, setServer] = useState(getDrawServer)
  const query = useQuery({ queryKey: ['draws'], queryFn: () => listDraws(session), enabled: !!server, refetchInterval: 60_000 })
  const draws = query.data ?? []

  if (!server) {
    return (
      <Page>
        <PageHeader title="Auslosung" />
        <EmptyState
          icon={BurrowMark}
          title="Gemeinsam aussuchen"
          text="Lade andere ein, swiped durch Filme und Serien und findet heraus, worauf alle Lust haben. Dafür braucht es den BurrowCinema Server."
        >
          <DrawServerDialog onChange={() => setServer(getDrawServer())}>
            <Button size="lg"><Server /> Server verbinden</Button>
          </DrawServerDialog>
        </EmptyState>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader title="Auslosung" subtitle="Swipen und gemeinsam entscheiden">
        <div className="flex gap-2">
          <Button asChild size="icon-lg" variant="secondary" aria-label="Statistik">
            <Link to="/draws/stats"><BarChart3 /></Link>
          </Button>
          <Button asChild size="lg">
            <Link to="/draws/new"><Plus /> Neu</Link>
          </Button>
        </div>
      </PageHeader>

      {query.isLoading && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-30 rounded-xl" />)}</div>}
      {query.isError && <EmptyState icon={BurrowMark} title="Server nicht erreichbar" text={query.error.message} />}
      {query.isSuccess && draws.length === 0 && (
        <EmptyState icon={BurrowMark} title="Noch keine Auslosungen" text="Leg die erste an und lade jemanden ein.">
          <Button asChild size="lg"><Link to="/draws/new"><Plus /> Neue Auslosung</Link></Button>
        </EmptyState>
      )}

      <div className="space-y-8">
        {SECTIONS.map(({ status, title }) => {
          const list = draws.filter((d) => d.status === status)
          if (!list.length) return null
          return (
            <section key={status}>
              <h2 className="mb-3 text-lg font-semibold">{title}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((draw) => <DrawCard key={draw.id} draw={draw} userId={session.userId} />)}
              </div>
            </section>
          )
        })}
      </div>
    </Page>
  )
}
