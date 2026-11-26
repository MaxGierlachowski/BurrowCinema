import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Page, PageHeader } from '@/components/AppShell'
import { BurrowMark } from '@/components/BurrowMark'
import { VoteList, type VoteRow } from '@/components/DrawParts'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@shared/hooks/useAuth'
import { getStats } from '@shared/draws'

const share = (r: VoteRow) => r.likes / r.votes

export default function DrawStats() {
  const session = useSession()
  const navigate = useNavigate()
  const [type, setType] = useState<'movie' | 'series'>('movie')
  const query = useQuery({ queryKey: ['draw-stats'], queryFn: () => getStats(session) })

  const rows: VoteRow[] = (query.data ?? [])
    .filter((r) => r.type === type)
    .map(({ likes, votes, draws, ...item }) => ({ item, likes, votes, note: draws > 1 ? `${draws} Auslosungen` : undefined }))
  const popular = [...rows].sort((a, b) => share(b) - share(a) || b.votes - a.votes).slice(0, 20)
  const unpopular = [...rows].sort((a, b) => share(a) - share(b) || b.votes - a.votes).slice(0, 10)

  return (
    <Page className="max-w-3xl">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon-lg" aria-label="Zurück" onClick={() => navigate('/draws')} className="-ml-2 shrink-0">
          <ArrowLeft />
        </Button>
        <PageHeader title="Statistik" subtitle="Über alle beendeten Auslosungen, an denen du beteiligt warst" />
      </div>

      <Tabs value={type} onValueChange={(v) => setType(v as 'movie' | 'series')} className="mb-6">
        <TabsList>
          <TabsTrigger value="movie">Filme</TabsTrigger>
          <TabsTrigger value="series">Serien</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isLoading && <Skeleton className="h-64 rounded-xl" />}
      {query.isError && <EmptyState icon={BurrowMark} title="Statistik nicht verfügbar" text={query.error.message} />}
      {query.isSuccess && rows.length === 0 && (
        <EmptyState icon={BurrowMark} title="Noch keine Daten" text="Sobald eine Auslosung beendet ist, erscheinen hier die Favoriten." />
      )}

      {rows.length > 0 && (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-lg font-semibold">Am beliebtesten</h2>
            <VoteList rows={popular} />
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Eher nicht</h2>
            <VoteList rows={unpopular} />
          </section>
        </div>
      )}
    </Page>
  )
}
