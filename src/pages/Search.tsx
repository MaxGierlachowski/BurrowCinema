import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Page } from '@/components/AppShell'
import { ArrDialog, ConnectedIcon } from '@/components/ArrConnect'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { PosterCard, PosterGrid, PosterGridSkeleton } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useSession } from '@shared/hooks/useAuth'
import { ARR_LABEL, getArrSettings, searchArr, type ArrKind } from '@shared/arr'
import { fromArr, fromJellyfin } from '@shared/folders'
import { getItems } from '@shared/jellyfin'

function useDebounced(value: string, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function ArrLink({ kind, connected, onChange }: { kind: ArrKind; connected: boolean; onChange: () => void }) {
  return (
    <ArrDialog kind={kind} onChange={onChange}>
      <button className="inline-flex items-center gap-1 font-medium text-primary underline decoration-primary/40 underline-offset-4">
        {ARR_LABEL[kind]}
        {connected && <ConnectedIcon />}
      </button>
    </ArrDialog>
  )
}

function ArrResults({ kind, term, knownIds }: { kind: ArrKind; term: string; knownIds: Set<string> }) {
  const query = useQuery({ queryKey: ['arr-search', kind, term], queryFn: () => searchArr(kind, term) })
  const results = query.data?.filter((item) => !knownIds.has(item.id)) ?? []
  const label = kind === 'radarr' ? 'Filme' : 'Serien'

  return (
    <Section title={`Nicht in der Bibliothek: ${label} (${ARR_LABEL[kind]})`}>
      {query.isLoading && <PosterGridSkeleton count={6} />}
      {query.isError && <p className="text-sm text-destructive">{ARR_LABEL[kind]}: {query.error.message}</p>}
      {query.isSuccess && results.length === 0 && <p className="text-sm text-muted-foreground">Keine weiteren Treffer.</p>}
      <PosterGrid>
        {results.slice(0, 24).map((item) => (
          <PosterCard
            key={item.id}
            item={fromArr(item)}
            badge={<Badge variant="secondary" className="bg-black/70 backdrop-blur">{item.inArr ? 'Angefragt' : 'Nicht geladen'}</Badge>}
          />
        ))}
      </PosterGrid>
    </Section>
  )
}

export default function Search() {
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [input, setInput] = useState(params.get('q') ?? '')
  const term = useDebounced(input.trim())
  const [arr, setArr] = useState(getArrSettings)
  const refreshArr = () => setArr(getArrSettings())

  useEffect(() => setParams(term ? { q: term } : {}, { replace: true }), [term, setParams])

  const library = useQuery({
    queryKey: ['search', term],
    queryFn: () => getItems(session, { type: 'Movie,Series', search: term, limit: 40 }),
    enabled: term.length >= 2,
  })

  const items = library.data?.Items ?? []
  const knownIds = new Set(items.flatMap((i) => [i.ProviderIds?.Tmdb, i.ProviderIds?.Tvdb]).filter((id): id is string => !!id))
  const searching = term.length >= 2

  return (
    <Page>
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Filme und Serien suchen"
          className="h-12 rounded-xl pl-11 text-base"
        />
      </div>

      {!searching && (
        <div className="mt-8">
          <EmptyState
            icon={BurrowMark}
            title="Was möchtest du finden?"
            text={
              <>
                Gesucht wird in deiner Jellyfin Bibliothek und, wenn eingerichtet, auch in{' '}
                <ArrLink kind="radarr" connected={!!arr.radarr} onChange={refreshArr} /> und{' '}
                <ArrLink kind="sonarr" connected={!!arr.sonarr} onChange={refreshArr} />.
              </>
            }
          />
        </div>
      )}

      {searching && library.isSuccess && (
        <Section title="In deiner Bibliothek">
          {items.length === 0 && <p className="text-sm text-muted-foreground">Nichts gefunden.</p>}
          <PosterGrid>
            {items.map((item) => (
              <PosterCard key={item.Id} item={fromJellyfin(session, item)} />
            ))}
          </PosterGrid>
        </Section>
      )}
      {searching && library.isLoading && <div className="mt-8"><PosterGridSkeleton count={6} /></div>}

      {/* Wait for the library so items already downloaded can be filtered out of the Radarr/Sonarr results. */}
      {searching && library.isSuccess && (['radarr', 'sonarr'] as const).map((kind) =>
        arr[kind] ? <ArrResults key={kind} kind={kind} term={term} knownIds={knownIds} /> : null,
      )}

      {searching && !arr.radarr && !arr.sonarr && (
        <div className="mt-8 rounded-xl border bg-card p-4 text-sm">
          <p className="text-muted-foreground">
            Verbinde <ArrLink kind="radarr" connected={false} onChange={refreshArr} /> oder{' '}
            <ArrLink kind="sonarr" connected={false} onChange={refreshArr} />, um auch Titel zu finden, die noch nicht
            heruntergeladen sind.
          </p>
        </div>
      )}
    </Page>
  )
}
