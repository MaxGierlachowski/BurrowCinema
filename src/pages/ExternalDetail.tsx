import { useQuery } from '@tanstack/react-query'
import { CloudOff, ExternalLink } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { AddToFolder } from '@/components/AddToFolder'
import { DetailLayout, DetailSkeleton } from '@/components/DetailLayout'
import { EmptyState } from '@/components/EmptyState'
import { RequestButton } from '@/components/RequestButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFolders } from '@shared/hooks/useFolders'
import { ARR_LABEL, getArrItem, type ArrKind } from '@shared/arr'
import { fromArr } from '@shared/folders'
import { formatRating, formatRuntime, plural } from '@shared/format'

export default function ExternalDetail() {
  const { source = 'radarr', id = '' } = useParams() as { source: ArrKind; id: string }
  const { folders } = useFolders()
  const { data: item, isLoading, error } = useQuery({
    queryKey: ['arr-item', source, id],
    queryFn: () => getArrItem(source, id),
  })

  if (isLoading) return <DetailSkeleton />
  if (!item) {
    const saved = folders.flatMap((f) => f.items).find((i) => i.key === `${source}:${id}`)
    return (
      <div className="p-4">
        <EmptyState icon={CloudOff} title={saved?.title ?? 'Titel nicht verfügbar'} text={error?.message}>
          <Button asChild variant="secondary">
            <Link to="/settings">Einstellungen öffnen</Link>
          </Button>
        </EmptyState>
      </div>
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
            <Badge key={f.id} variant="secondary">{f.name}</Badge>
          ))}
        </>
      }
      actions={
        <>
          <RequestButton item={item} />
          <AddToFolder item={folderItem} variant="secondary" />
          {item.imdbId && (
            <Button asChild size="lg" variant="secondary">
              <a href={`https://www.imdb.com/title/${item.imdbId}`} target="_blank" rel="noreferrer">
                <ExternalLink /> IMDb
              </a>
            </Button>
          )}
        </>
      }
    />
  )
}
