import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { getStats } from '@shared/draws'
import { useSession } from '@shared/hooks/useAuth'
import { colors } from '@shared/theme'
import { BurrowMark } from '@/components/BurrowMark'
import { BackHeader, SectionTitle, useScreenPadding, VoteList, type VoteRow } from '@/components/draws/DrawParts'
import { Segmented } from '@/components/draws/Segmented'
import { useManualRefresh } from '@/components/draws/useManualRefresh'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'

type Kind = 'movie' | 'series'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'movie', label: 'Filme' },
  { value: 'series', label: 'Serien' },
]

const share = (r: VoteRow) => r.likes / r.votes

export default function DrawStats() {
  const session = useSession()
  const padding = useScreenPadding()
  const [type, setType] = useState<Kind>('movie')
  const query = useQuery({ queryKey: ['draw-stats'], queryFn: () => getStats(session) })
  const { refreshing, onRefresh } = useManualRefresh(query.refetch)

  const rows: VoteRow[] = (query.data ?? [])
    .filter((r) => r.type === type)
    .map(({ likes, votes, draws, ...item }) => ({ item, likes, votes, note: draws > 1 ? `${draws} Auslosungen` : undefined }))
  const popular = [...rows].sort((a, b) => share(b) - share(a) || b.votes - a.votes).slice(0, 20)
  const unpopular = [...rows].sort((a, b) => share(a) - share(b) || b.votes - a.votes).slice(0, 10)

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={padding}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.card} />}
    >
      <BackHeader title="Statistik" subtitle="Über alle beendeten Auslosungen, an denen du beteiligt warst" />

      <Segmented value={type} onChange={setType} options={KINDS} className="mb-6 w-60" />

      {query.isLoading && <Skeleton className="h-64 rounded-xl" />}
      {query.isError && <EmptyState icon={BurrowMark} title="Statistik nicht verfügbar" text={query.error.message} />}
      {query.isSuccess && rows.length === 0 && (
        <EmptyState icon={BurrowMark} title="Noch keine Daten" text="Sobald eine Auslosung beendet ist, erscheinen hier die Favoriten." />
      )}

      {rows.length > 0 && (
        <View className="gap-10">
          <View>
            <SectionTitle>Am beliebtesten</SectionTitle>
            <VoteList rows={popular} />
          </View>
          <View>
            <SectionTitle>Eher nicht</SectionTitle>
            <VoteList rows={unpopular} />
          </View>
        </View>
      )}
    </ScrollView>
  )
}
