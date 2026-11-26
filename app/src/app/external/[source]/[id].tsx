import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { CloudOff, ExternalLink } from 'lucide-react-native'
import { Linking } from 'react-native'
import { ARR_LABEL, getArrItem, type ArrKind } from '@shared/arr'
import { fromArr } from '@shared/folders'
import { formatRating, formatRuntime, plural } from '@shared/format'
import { useFolders } from '@shared/hooks/useFolders'
import { EmptyState } from '@/components/EmptyState'
import { AddToFolder } from '@/components/media/AddToFolder'
import { DetailLayout, DetailMessage, DetailSkeleton } from '@/components/media/DetailLayout'
import { RequestButton } from '@/components/media/RequestButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function ExternalDetail() {
  const { source = 'radarr', id = '' } = useLocalSearchParams<{ source: ArrKind; id: string }>()
  const { folders } = useFolders()
  const { data: item, isLoading, error } = useQuery({
    queryKey: ['arr-item', source, id],
    queryFn: () => getArrItem(source, id),
  })

  if (isLoading) return <DetailSkeleton />
  if (!item) {
    const saved = folders.flatMap((f) => f.items).find((i) => i.key === `${source}:${id}`)
    return (
      <DetailMessage>
        <EmptyState icon={CloudOff} title={saved?.title ?? 'Titel nicht verfügbar'} text={error?.message}>
          <Button variant="secondary" onPress={() => router.navigate('/settings')}>
            Einstellungen öffnen
          </Button>
        </EmptyState>
      </DetailMessage>
    )
  }

  const folderItem = fromArr(item)
  const inFolders = folders.filter((f) => f.items.some((i) => i.key === folderItem.key))

  return (
    <DetailLayout
      title={item.title}
      backdrop={item.fanart}
      poster={item.poster}
      meta={[
        item.year?.toString(),
        source === 'radarr' ? formatRuntime(item.runtime) : item.seasonCount ? plural(item.seasonCount, 'Staffel', 'Staffeln') : undefined,
        item.network,
        formatRating(item.rating),
      ]}
      genres={item.genres}
      overview={item.overview}
      badges={
        <>
          <Badge variant="destructive">Nicht in Jellyfin</Badge>
          <Badge variant="outline">{item.inArr ? `In ${ARR_LABEL[source]} angefragt` : `Noch nicht in ${ARR_LABEL[source]}`}</Badge>
          {inFolders.map((f) => (
            <Badge key={f.id} variant="secondary">
              {f.name}
            </Badge>
          ))}
        </>
      }
      actions={
        <>
          <RequestButton item={item} />
          <AddToFolder item={folderItem} variant="secondary" />
          {item.imdbId && (
            <Button size="lg" variant="secondary" icon={ExternalLink} onPress={() => Linking.openURL(`https://www.imdb.com/title/${item.imdbId}`)}>
              IMDb
            </Button>
          )}
        </>
      }
    />
  )
}
