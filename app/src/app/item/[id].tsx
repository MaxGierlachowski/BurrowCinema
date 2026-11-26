import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { ExternalLink } from 'lucide-react-native'
import { Linking, View } from 'react-native'
import { fromJellyfin } from '@shared/folders'
import { formatRating, formatRuntime, plural, ticksToMinutes } from '@shared/format'
import { useSession } from '@shared/hooks/useAuth'
import { useFolders } from '@shared/hooks/useFolders'
import { getItem, getSeasons, imageUrl, personImageUrl, posterUrl, webUrl, type BaseItem } from '@shared/jellyfin'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { AddToFolder } from '@/components/media/AddToFolder'
import { DetailLayout, DetailMessage, DetailSkeleton, Row } from '@/components/media/DetailLayout'
import { Poster } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

function Seasons({ series }: { series: BaseItem }) {
  const session = useSession()
  const { data: seasons = [] } = useQuery({ queryKey: ['seasons', series.Id], queryFn: () => getSeasons(session, series.Id) })
  if (!seasons.length) return null

  return (
    <Row
      title={plural(seasons.length, 'Staffel', 'Staffeln')}
      data={seasons}
      itemWidth={112}
      keyExtractor={(season) => season.Id}
      renderItem={(season) => (
        <View>
          <View className="aspect-[2/3] overflow-hidden rounded-lg border border-white/5 bg-muted">
            <Poster src={posterUrl(session, season, 300) ?? posterUrl(session, series, 300)} title={season.Name} />
          </View>
          <Text className="mt-1.5 text-sm font-medium" numberOfLines={1}>
            {season.Name}
          </Text>
          {season.ChildCount !== undefined && <Text className="text-xs text-muted-foreground">{plural(season.ChildCount, 'Folge', 'Folgen')}</Text>}
        </View>
      )}
    />
  )
}

function Cast({ item }: { item: BaseItem }) {
  const session = useSession()
  const actors = item.People?.filter((p) => p.Type === 'Actor').slice(0, 20) ?? []
  if (!actors.length) return null

  return (
    <Row
      title="Besetzung"
      data={actors}
      itemWidth={80}
      keyExtractor={(person) => person.Id + person.Role}
      renderItem={(person) => (
        <View className="items-center">
          <View className="aspect-square w-full overflow-hidden rounded-full border border-white/10 bg-muted">
            <Poster src={personImageUrl(session, person)} title={person.Name.split(' ').map((w) => w[0]).join('')} />
          </View>
          <Text className="mt-1.5 text-center text-xs font-medium" numberOfLines={2}>
            {person.Name}
          </Text>
          {person.Role && (
            <Text className="text-center text-[11px] text-muted-foreground" numberOfLines={1}>
              {person.Role}
            </Text>
          )}
        </View>
      )}
    />
  )
}

export default function ItemDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const session = useSession()
  const { folders } = useFolders()
  const { data: item, isLoading, error } = useQuery({ queryKey: ['item', id], queryFn: () => getItem(session, id) })

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

  return (
    <DetailLayout
      title={item.Name}
      backdrop={item.BackdropImageTags?.length ? imageUrl(session, item.Id, 'Backdrop', 1600) : undefined}
      poster={posterUrl(session, item, 500)}
      logo={item.ImageTags?.Logo ? imageUrl(session, item.Id, 'Logo', 600) : undefined}
      meta={[
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
          <Badge>{isSeries ? 'Serie' : 'Film'}</Badge>
          {inFolders.map((f) => (
            <Badge key={f.id} variant="secondary">
              {f.name}
            </Badge>
          ))}
        </>
      }
      actions={
        <>
          <AddToFolder item={folderItem} />
          <Button size="lg" variant="secondary" icon={ExternalLink} onPress={() => Linking.openURL(webUrl(session, item.Id))}>
            In Jellyfin öffnen
          </Button>
        </>
      }
    >
      {isSeries && <Seasons series={item} />}
      <Cast item={item} />
    </DetailLayout>
  )
}
