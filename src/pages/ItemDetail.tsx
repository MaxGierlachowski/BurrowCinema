import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { useParams } from 'react-router'
import { AddToFolder } from '@/components/AddToFolder'
import { BurrowMark } from '@/components/BurrowMark'
import { DetailLayout, DetailSkeleton, Row } from '@/components/DetailLayout'
import { EmptyState } from '@/components/EmptyState'
import { Poster } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/useAuth'
import { useFolders } from '@/hooks/useFolders'
import { fromJellyfin } from '@/lib/folders'
import { formatRating, formatRuntime, plural, ticksToMinutes } from '@/lib/format'
import { getItem, getSeasons, imageUrl, personImageUrl, posterUrl, webUrl, type BaseItem } from '@/lib/jellyfin'

function Seasons({ series }: { series: BaseItem }) {
  const session = useSession()
  const { data: seasons = [] } = useQuery({ queryKey: ['seasons', series.Id], queryFn: () => getSeasons(session, series.Id) })
  if (!seasons.length) return null

  return (
    <Row title={plural(seasons.length, 'Staffel', 'Staffeln')}>
      {seasons.map((season) => (
        <div key={season.Id} className="w-28 shrink-0 snap-start sm:w-32">
          <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-white/5">
            <Poster src={posterUrl(session, season, 300) ?? posterUrl(session, series, 300)} title={season.Name} />
          </div>
          <p className="mt-1.5 truncate text-sm font-medium">{season.Name}</p>
          {season.ChildCount !== undefined && (
            <p className="text-xs text-muted-foreground">{plural(season.ChildCount, 'Folge', 'Folgen')}</p>
          )}
        </div>
      ))}
    </Row>
  )
}

function Cast({ item }: { item: BaseItem }) {
  const session = useSession()
  const actors = item.People?.filter((p) => p.Type === 'Actor').slice(0, 20) ?? []
  if (!actors.length) return null

  return (
    <Row title="Besetzung">
      {actors.map((person) => (
        <div key={person.Id + person.Role} className="w-20 shrink-0 snap-start text-center sm:w-24">
          <div className="mx-auto aspect-square overflow-hidden rounded-full bg-muted ring-1 ring-white/10">
            <Poster src={personImageUrl(session, person)} title={person.Name.split(' ').map((w) => w[0]).join('')} />
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs font-medium">{person.Name}</p>
          {person.Role && <p className="line-clamp-1 text-[11px] text-muted-foreground">{person.Role}</p>}
        </div>
      ))}
    </Row>
  )
}

export default function ItemDetail() {
  const { id = '' } = useParams()
  const session = useSession()
  const { folders } = useFolders()
  const { data: item, isLoading, error } = useQuery({ queryKey: ['item', id], queryFn: () => getItem(session, id) })

  if (isLoading) return <DetailSkeleton />
  if (!item) return <div className="p-4"><EmptyState icon={BurrowMark} title="Dieser Gang führt nirgendwohin" text={error?.message ?? "Titel nicht gefunden"} /></div>

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
            <Badge key={f.id} variant="secondary">{f.name}</Badge>
          ))}
        </>
      }
      actions={
        <>
          <AddToFolder item={folderItem} />
          <Button asChild size="lg" variant="secondary">
            <a href={webUrl(session, item.Id)} target="_blank" rel="noreferrer">
              <ExternalLink /> In Jellyfin öffnen
            </a>
          </Button>
        </>
      }
    >
      {isSeries && <Seasons series={item} />}
      <Cast item={item} />
    </DetailLayout>
  )
}
