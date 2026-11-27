import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronLeft, ChevronRight, ExternalLink, Film, ListVideo, Play } from 'lucide-react-native'
import { useState } from 'react'
import { Linking, View } from 'react-native'
import { fromJellyfin } from '@shared/folders'
import { formatRating, formatRuntime, plural, ticksToMinutes } from '@shared/format'
import { useSession } from '@shared/hooks/useAuth'
import { useFolders } from '@shared/hooks/useFolders'
import {
  backdropUrl,
  getAdjacentEpisodes,
  getEpisodes,
  getItem,
  getNextUp,
  getSeasons,
  getSimilar,
  imageUrl,
  personImageUrl,
  posterUrl,
  seriesPosterUrl,
  webUrl,
  type BaseItem,
} from '@shared/jellyfin'
import { shouldOfferResume } from '@shared/playback'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { AddToFolder } from '@/components/media/AddToFolder'
import { DetailLayout, DetailMessage, DetailSkeleton, Row } from '@/components/media/DetailLayout'
import { nextEpisodeOf } from '@/components/media/EpisodeList'
import { FavoriteButton } from '@/components/media/FavoriteButton'
import { episodeCode, PersonCard, Thumb } from '@/components/media/MediaCard'
import { PlayActions } from '@/components/media/PlayActions'
import { VersionPicker } from '@/components/media/VersionPicker'
import { WatchedButton } from '@/components/media/WatchedButton'
import { Poster, PosterCard } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { features } from '@/lib/features'
import { qk } from '@/lib/queryKeys'
import { itemHref, playHref, seasonHref } from '@/lib/routes'
import { Focusable, isTV } from '@/lib/tv'

function Seasons({ series }: { series: BaseItem }) {
  const session = useSession()
  const { data: seasons = [] } = useQuery({ queryKey: qk.seasons(series.Id), queryFn: () => getSeasons(session, series.Id) })
  if (!seasons.length) return null

  return (
    <Row
      title={plural(seasons.length, 'Staffel', 'Staffeln')}
      data={seasons}
      itemWidth={112}
      keyExtractor={(season) => season.Id}
      renderItem={(season) => (
        <Focusable accessibilityLabel={season.Name} onPress={() => router.push(seasonHref(season.Id, series.Id))} className="rounded-lg">
          <View className="aspect-[2/3] overflow-hidden rounded-lg border border-white/5 bg-muted">
            <Poster src={posterUrl(session, season, 300) ?? posterUrl(session, series, 300)} title={season.Name} />
          </View>
          <Text className="mt-1.5 text-sm font-medium" numberOfLines={1}>
            {season.Name}
          </Text>
          {season.ChildCount !== undefined && (
            <Text className="text-xs text-muted-foreground">{plural(season.ChildCount, 'Folge', 'Folgen')}</Text>
          )}
        </Focusable>
      )}
    />
  )
}

function Cast({ item }: { item: BaseItem }) {
  const session = useSession()
  const actors = item.People?.filter((p) => p.Type === 'Actor' || p.Type === 'GuestStar').slice(0, 20) ?? []
  if (!actors.length) return null

  return (
    <Row
      title="Besetzung"
      data={actors}
      itemWidth={80}
      keyExtractor={(person) => person.Id + person.Role}
      renderItem={(person) => <PersonCard id={person.Id} name={person.Name} role={person.Role} image={personImageUrl(session, person)} />}
    />
  )
}

function Similar({ item }: { item: BaseItem }) {
  const session = useSession()
  const { data = [] } = useQuery({ queryKey: qk.similar(item.Id), queryFn: () => getSimilar(session, item.Id) })
  if (!data.length) return null
  return (
    <Row
      title="Ähnliche Titel"
      data={data}
      itemWidth={112}
      keyExtractor={(similar) => similar.Id}
      renderItem={(similar) => <PosterCard item={fromJellyfin(session, similar)} />}
    />
  )
}

/** Next Up episode of a series, else the next unwatched episode of its first season. */
function useSeriesTarget(series: BaseItem) {
  const session = useSession()
  const nextUp = useQuery({ queryKey: qk.nextUpSeries(series.Id), queryFn: () => getNextUp(session, { seriesId: series.Id, limit: 1 }) })
  const seasons = useQuery({ queryKey: qk.seasons(series.Id), queryFn: () => getSeasons(session, series.Id) })
  const first = seasons.data?.find((season) => (season.IndexNumber ?? 0) > 0) ?? seasons.data?.[0]
  const episodes = useQuery({
    queryKey: qk.episodes(first?.Id ?? ''),
    queryFn: () => getEpisodes(session, series.Id, first!.Id),
    enabled: !!first && nextUp.isSuccess && !nextUp.data.length,
  })
  const next = nextUp.data?.[0]
  return { next, target: next ?? (episodes.data?.length ? nextEpisodeOf(episodes.data) : undefined) }
}

function NextEpisode({ episode }: { episode: BaseItem }) {
  const code = episodeCode(episode)
  return (
    <View className="mt-10">
      <Text className="mb-3 text-lg font-semibold">Nächste Folge</Text>
      <View className="flex-row gap-3">
        <Focusable accessibilityLabel={episode.Name} onPress={() => router.push(itemHref(episode.Id))} className="w-40 rounded-lg">
          <Thumb item={episode} />
        </Focusable>
        <View className="min-w-0 flex-1 gap-1.5">
          <Text className="font-medium" numberOfLines={2}>
            {code ? `${code} · ${episode.Name}` : episode.Name}
          </Text>
          {!!episode.Overview && (
            <Text className="text-sm text-muted-foreground" numberOfLines={3}>
              {episode.Overview}
            </Text>
          )}
          {features.player && (
            <Button
              size="sm"
              icon={Play}
              className="mt-1 self-start"
              onPress={() => router.push(playHref(episode.Id, { start: shouldOfferResume(episode) ? 'resume' : 'beginning' }))}
            >
              Abspielen
            </Button>
          )}
        </View>
      </View>
    </View>
  )
}

/** Previous and next episode plus the way to the whole season. */
function EpisodeNav({ episode }: { episode: BaseItem }) {
  const session = useSession()
  const seriesId = episode.SeriesId ?? ''
  const { data } = useQuery({
    queryKey: ['adjacent', episode.Id],
    queryFn: () => getAdjacentEpisodes(session, seriesId, episode.Id),
    enabled: !!seriesId,
  })
  return (
    <View className="mt-8 flex-row flex-wrap gap-2">
      {data?.previous && (
        <Button variant="secondary" icon={ChevronLeft} onPress={() => router.replace(itemHref(data.previous!.Id))}>
          Vorherige Folge
        </Button>
      )}
      {data?.next && (
        <Button variant="secondary" icon={ChevronRight} onPress={() => router.replace(itemHref(data.next!.Id))}>
          Nächste Folge
        </Button>
      )}
      {!!episode.SeasonId && !!seriesId && (
        <Button variant="secondary" icon={ListVideo} onPress={() => router.push(seasonHref(episode.SeasonId!, seriesId))}>
          Alle Folgen
        </Button>
      )}
    </View>
  )
}

function SeriesPlay({ series }: { series: BaseItem }) {
  const { target } = useSeriesTarget(series)
  if (!target) return null
  return <PlayActions item={target} caption={episodeCode(target)} preferredFocus />
}

function SeriesNextUp({ series }: { series: BaseItem }) {
  const { next } = useSeriesTarget(series)
  return next ? <NextEpisode episode={next} /> : null
}

function ItemDetail({ id }: { id: string }) {
  const session = useSession()
  const { folders } = useFolders()
  const [sourceId, setSourceId] = useState<string>()
  const { data: item, isLoading, error } = useQuery({ queryKey: qk.item(id), queryFn: () => getItem(session, id) })

  if (isLoading) return <DetailSkeleton />
  if (!item) {
    return (
      <DetailMessage>
        <EmptyState icon={BurrowMark} title="Dieser Gang führt nirgendwohin" text={error?.message ?? 'Titel nicht gefunden'} />
      </DetailMessage>
    )
  }

  const folderItem = fromJellyfin(session, item)
  const inFolders = folders.filter((f) => f.items.some((i) => i.key === folderItem.key))
  const director = item.People?.find((p) => p.Type === 'Director')?.Name
  const isSeries = item.Type === 'Series'
  const isEpisode = item.Type === 'Episode'
  const trailer = item.RemoteTrailers?.[0]?.Url
  const seriesBackdrop = item.SeriesId ? imageUrl(session, item.SeriesId, 'Backdrop', 1600) : undefined

  return (
    <DetailLayout
      title={item.Name}
      kicker={
        isEpisode && item.SeriesId ? (
          <Focusable accessibilityRole="link" onPress={() => router.push(itemHref(item.SeriesId!))} className="self-start rounded-md">
            <Text className="text-sm font-medium text-primary" numberOfLines={1}>
              {item.SeriesName}
            </Text>
          </Focusable>
        ) : undefined
      }
      backdrop={backdropUrl(session, item) ?? (isEpisode ? seriesBackdrop : undefined)}
      poster={seriesPosterUrl(session, item, 500)}
      logo={item.ImageTags?.Logo ? imageUrl(session, item.Id, 'Logo', 600) : undefined}
      meta={[
        episodeCode(item),
        item.ProductionYear?.toString(),
        isSeries ? undefined : formatRuntime(ticksToMinutes(item.RunTimeTicks)),
        item.OfficialRating,
        formatRating(item.CommunityRating),
        director && `Regie: ${director}`,
      ]}
      genres={item.Genres}
      tagline={item.Taglines?.[0]}
      overview={item.Overview}
      badges={
        <>
          <Badge>{isSeries ? 'Serie' : isEpisode ? 'Folge' : 'Film'}</Badge>
          {inFolders.map((f) => (
            <Badge key={f.id} variant="secondary">
              {f.name}
            </Badge>
          ))}
        </>
      }
      actions={
        <>
          {isSeries ? (
            <SeriesPlay series={item} />
          ) : (
            <>
              <VersionPicker sources={item.MediaSources} value={sourceId} onChange={setSourceId} />
              <PlayActions item={item} mediaSourceId={sourceId} preferredFocus />
            </>
          )}
          <WatchedButton item={item} />
          <FavoriteButton item={item} />
          {!isEpisode && <AddToFolder item={folderItem} variant="secondary" />}
          {!!trailer && (
            <Button size="lg" variant="secondary" icon={Film} onPress={() => Linking.openURL(trailer)}>
              Trailer
            </Button>
          )}
          {!isTV && (
            <Button size="lg" variant="secondary" icon={ExternalLink} onPress={() => Linking.openURL(webUrl(session, item.Id))}>
              In Jellyfin öffnen
            </Button>
          )}
        </>
      }
    >
      {isEpisode && <EpisodeNav episode={item} />}
      {isSeries && <SeriesNextUp series={item} />}
      {isSeries && <Seasons series={item} />}
      <Cast item={item} />
      {!isEpisode && <Similar item={item} />}
    </DetailLayout>
  )
}

export default function ItemRoute() {
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  // A new key per title, so switching to the next episode starts with fresh state.
  return <ItemDetail key={id} id={id} />
}
