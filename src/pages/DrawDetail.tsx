import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleStop, MoreHorizontal, PartyPopper, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Page } from '@/components/AppShell'
import { BurrowMark } from '@/components/BurrowMark'
import { Row } from '@/components/DetailLayout'
import { ParticipantList, ProgressBar, VoteList, type VoteRow } from '@/components/DrawParts'
import { EmptyState } from '@/components/EmptyState'
import { PosterCard } from '@/components/PosterCard'
import { SwipeDeck } from '@/components/SwipeDeck'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/hooks/useAuth'
import { deleteDraw, describeStatus, endDraw, formatDate, getDraw, shuffleFor, swipe, TYPE_LABEL, type DrawDetail as Draw, type DrawItem } from '@/lib/draws'

function Results({ draw }: { draw: Draw }) {
  const votes = new Map(draw.results?.map((r) => [r.key, r]))
  const rows: VoteRow[] = draw.items
    .map((item) => ({ item, likes: votes.get(item.key)?.likes ?? 0, votes: votes.get(item.key)?.votes ?? 0 }))
    .filter((r) => r.votes > 0)
    .map((r) => ({ ...r, unanimous: r.likes === draw.participants.length }))
    .sort((a, b) => b.likes - a.likes || b.likes / b.votes - a.likes / a.votes || a.item.title.localeCompare(b.item.title))
  const unanimous = rows.filter((r) => r.unanimous)

  if (!rows.length) return <EmptyState icon={BurrowMark} title="Keine Stimmen" text="In dieser Auslosung hat niemand geswiped." />

  return (
    <div className="space-y-8">
      {unanimous.length > 0 && (
        <Row title="Darauf haben alle Lust">
          {unanimous.map(({ item }) => (
            <div key={item.key} className="w-32 shrink-0 snap-start">
              <PosterCard item={item} />
            </div>
          ))}
        </Row>
      )}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Rangliste</h2>
        <VoteList rows={rows} />
      </section>
    </div>
  )
}

function Swiping({ draw }: { draw: Draw }) {
  const session = useSession()
  const queryClient = useQueryClient()
  const [mine, setMine] = useState(draw.mySwipes)
  const [history, setHistory] = useState<string[]>([])
  const deck = useMemo(() => shuffleFor(draw.items, session.userId + draw.id), [draw.items, draw.id, session.userId])
  const remaining = deck.filter((item) => !(item.key in mine))

  const save = (key: string, like: boolean | null, rollback: () => void) =>
    swipe(session, draw.id, key, like)
      .then(() => queryClient.invalidateQueries({ queryKey: ['draws'] }))
      .catch((err) => {
        rollback()
        toast.error(`Nicht gespeichert: ${err.message}`)
      })

  const onSwipe = (item: DrawItem, like: boolean) => {
    setMine((m) => ({ ...m, [item.key]: like }))
    setHistory((h) => [...h, item.key])
    save(item.key, like, () => setMine(({ [item.key]: _, ...rest }) => rest))
  }

  const onUndo = () => {
    const key = history.at(-1)
    if (!key) return
    const previous = mine[key]
    setHistory((h) => h.slice(0, -1))
    setMine(({ [key]: _, ...rest }) => rest)
    save(key, null, () => setMine((m) => ({ ...m, [key]: previous })))
  }

  const done = draw.items.length - remaining.length

  if (!remaining.length) {
    return (
      <EmptyState
        icon={PartyPopper}
        title="Alles bewertet"
        text={`Du hast alle ${draw.items.length} Titel geswiped. Das Ergebnis gibt es, sobald die Auslosung endet (${formatDate(draw.endsAt)}).`}
      >
        {history.length > 0 && <Button variant="secondary" onClick={onUndo}>Letzten Swipe zurücknehmen</Button>}
      </EmptyState>
    )
  }

  return (
    <div className="space-y-3">
      <div className="mx-auto flex max-w-sm items-center gap-3 text-xs text-muted-foreground">
        <ProgressBar value={done / draw.items.length} className="flex-1" />
        {done} / {draw.items.length}
      </div>
      <SwipeDeck items={remaining} onSwipe={onSwipe} onUndo={onUndo} canUndo={history.length > 0} />
    </div>
  )
}

export default function DrawDetail() {
  const { id = '' } = useParams()
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const query = useQuery({
    queryKey: ['draw', id],
    queryFn: () => getDraw(session, id),
    refetchInterval: (q) => (q.state.data?.status === 'ended' ? false : 60_000),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['draw', id] })
    queryClient.invalidateQueries({ queryKey: ['draws'] })
  }
  const end = useMutation({ mutationFn: () => endDraw(session, id), onSuccess: refresh, onError: (e) => toast.error(e.message) })
  const remove = useMutation({
    mutationFn: () => deleteDraw(session, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] })
      navigate('/draws', { replace: true })
    },
    onError: (e) => toast.error(e.message),
  })

  const draw = query.data
  if (query.isLoading) return <Page><Skeleton className="mx-auto aspect-[2/3] max-w-sm rounded-2xl" /></Page>
  if (!draw) return <Page><EmptyState icon={BurrowMark} title="Dieser Gang führt nirgendwohin" text={query.error?.message} /></Page>

  return (
    <Page className="max-w-3xl">
      <div className="mb-4 flex items-start gap-3">
        <Button variant="ghost" size="icon-lg" aria-label="Zurück" onClick={() => navigate('/draws')} className="-ml-2 shrink-0">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{draw.title}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {describeStatus(draw)} · {draw.sourceLabel} · {TYPE_LABEL[draw.itemType]} · von {draw.owner.name}
          </p>
        </div>
        {draw.isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon-lg" aria-label="Aktionen"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {draw.status !== 'ended' && (
                <DropdownMenuItem onSelect={() => end.mutate()}><CircleStop /> Jetzt beenden</DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}><Trash2 /> Löschen</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {draw.status === 'scheduled' && (
        <EmptyState icon={BurrowMark} title="Noch etwas Geduld" text={`Die Auslosung startet ${formatDate(draw.startsAt)}.`} />
      )}
      {draw.status === 'running' && <Swiping key={draw.id} draw={draw} />}
      {draw.status === 'ended' && <Results draw={draw} />}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Teilnehmer</h2>
        <ParticipantList participants={draw.participants} total={draw.itemCount} />
      </section>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auslosung löschen?</DialogTitle>
            <DialogDescription>„{draw.title}“ und alle Stimmen werden für alle Teilnehmer entfernt.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={() => remove.mutate()}>Löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
