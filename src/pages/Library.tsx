import { useInfiniteQuery } from '@tanstack/react-query'
import { Film } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { Page, PageHeader } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { LoadMore, PosterCard, PosterGrid, PosterGridSkeleton } from '@/components/PosterCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/hooks/useAuth'
import { fromJellyfin } from '@/lib/folders'
import { getItems, type ItemType, type SortKey } from '@/lib/jellyfin'

const SORTS: Record<SortKey, string> = {
  DateCreated: 'Neu hinzugefügt',
  SortName: 'Name',
  ProductionYear: 'Erscheinungsjahr',
  CommunityRating: 'Bewertung',
}

export default function Library() {
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const type = (params.get('type') ?? 'Movie') as ItemType
  const sort = (params.get('sort') ?? 'DateCreated') as SortKey

  const setParam = (key: string, value: string) =>
    setParams((p) => {
      p.set(key, value)
      return p
    }, { replace: true })

  const query = useInfiniteQuery({
    queryKey: ['items', type, sort],
    queryFn: ({ pageParam }) => getItems(session, { type, sort, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.Items.length, 0)
      return loaded < last.TotalRecordCount ? loaded : undefined
    },
  })

  const items = query.data?.pages.flatMap((p) => p.Items) ?? []
  const total = query.data?.pages[0]?.TotalRecordCount

  return (
    <Page>
      <PageHeader title="Bibliothek" subtitle={total !== undefined ? `${total} Titel` : undefined}>
        <div className="flex w-full gap-2 sm:w-auto">
          <Tabs value={type} onValueChange={(v) => setParam('type', v)} className="flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="Movie">Filme</TabsTrigger>
              <TabsTrigger value="Series">Serien</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
            <SelectTrigger className="w-40" aria-label="Sortierung">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {Object.entries(SORTS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {query.isLoading && <PosterGridSkeleton />}
      {query.isError && <EmptyState icon={Film} title="Bibliothek konnte nicht geladen werden" text={query.error.message} />}
      {query.isSuccess && items.length === 0 && <EmptyState icon={Film} title="Hier ist noch nichts" />}

      <PosterGrid>
        {items.map((item) => (
          <PosterCard key={item.Id} item={fromJellyfin(session, item)} />
        ))}
      </PosterGrid>
      {query.isFetchingNextPage && <div className="mt-4"><PosterGridSkeleton count={6} /></div>}
      <LoadMore onVisible={query.fetchNextPage} enabled={query.hasNextPage && !query.isFetchingNextPage} />
    </Page>
  )
}
