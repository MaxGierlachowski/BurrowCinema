import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { plural } from '@shared/format'
import { useSession } from '@shared/hooks/useAuth'
import { backdropUrl, getEpisodes, getItem, seriesPosterUrl } from '@shared/jellyfin'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { DetailLayout, DetailMessage, DetailSkeleton } from '@/components/media/DetailLayout'
import { EpisodeList, nextEpisodeOf } from '@/components/media/EpisodeList'
import { episodeCode } from '@/components/media/MediaCard'
import { PlayActions } from '@/components/media/PlayActions'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { features } from '@/lib/features'
import { qk } from '@/lib/queryKeys'
import { itemHref } from '@/lib/routes'
import { Focusable } from '@/lib/tv'

export default function SeasonScreen() {
  const { id = '', seriesId: seriesParam } = useLocalSearchParams<{ id: string; seriesId?: string }>()
  const session = useSession()
  const season = useQuery({ queryKey: qk.item(id), queryFn: () => getItem(session, id) })
  const seriesId = seriesParam || season.data?.SeriesId || ''
  const series = useQuery({ queryKey: qk.item(seriesId), queryFn: () => getItem(session, seriesId), enabled: !!seriesId })
  const episodes = useQuery({ queryKey: qk.episodes(id), queryFn: () => getEpisodes(session, seriesId, id), enabled: !!seriesId })

  if (season.isLoading) return <DetailSkeleton />
  if (!season.data) {
    return (
      <DetailMessage>
        <EmptyState icon={BurrowMark} title="Dieser Gang führt nirgendwohin" text={season.error?.message ?? 'Staffel nicht gefunden'} />
      </DetailMessage>
    )
  }

  const list = episodes.data ?? []
  const next = list.length ? nextEpisodeOf(list) : undefined
  const show = series.data

  return (
    <DetailLayout
      title={season.data.Name}
      kicker={
        show ? (
          <Focusable accessibilityRole="link" onPress={() => router.push(itemHref(show.Id))} className="self-start rounded-md">
            <Text className="text-sm font-medium text-primary" numberOfLines={1}>
              {show.Name}
            </Text>
          </Focusable>
        ) : undefined
      }
      backdrop={(show && backdropUrl(session, show)) ?? backdropUrl(session, season.data)}
      poster={seriesPosterUrl(session, season.data, 500) ?? (show && seriesPosterUrl(session, show, 500))}
      meta={[list.length ? plural(list.length, 'Folge', 'Folgen') : undefined, season.data.ProductionYear?.toString()]}
      overview={season.data.Overview ?? show?.Overview}
      actions={next ? <PlayActions item={next} caption={episodeCode(next)} preferredFocus /> : undefined}
    >
      <View className="mt-8">
        {episodes.isLoading && <Skeleton className="h-48 rounded-xl" />}
        {episodes.isError && <Text className="text-sm text-destructive">{episodes.error.message}</Text>}
        {/* Without the player the next episode itself takes the TV focus. */}
        <EpisodeList episodes={list} focusId={features.player ? undefined : next?.Id} />
      </View>
    </DetailLayout>
  )
}
