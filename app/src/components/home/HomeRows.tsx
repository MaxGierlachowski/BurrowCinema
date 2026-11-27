import { useQuery } from '@tanstack/react-query'
import { View } from 'react-native'
import { fromJellyfin } from '@shared/folders'
import { useSession } from '@shared/hooks/useAuth'
import { getLatest, getNextUp, getResume, getUserViews, seriesPosterUrl, type BaseItem, type UserView } from '@shared/jellyfin'
import { Row } from '@/components/media/DetailLayout'
import { MediaCard } from '@/components/media/MediaCard'
import { PosterCard } from '@/components/PosterCard'
import { qk } from '@/lib/queryKeys'
import { isTV } from '@/lib/tv'

/** What useFocusMemory returns: which card gets the TV focus back, and remembering the chosen one. */
export type FocusMemory = { preferred: (key: string) => boolean; remember: (key: string) => void }

const WIDE = isTV ? 260 : 240
const POSTER = isTV ? 132 : 112
const LIBRARY_TYPES = new Set(['movies', 'tvshows'])

export function useResume() {
  const session = useSession()
  return useQuery({ queryKey: qk.homeResume, queryFn: () => getResume(session) })
}

/** Movie and series libraries of the user, in the server's order. */
export function useLibraryViews() {
  const session = useSession()
  return useQuery({
    queryKey: qk.homeViews,
    queryFn: () => getUserViews(session),
    select: (views) => views.filter((view) => LIBRARY_TYPES.has(view.CollectionType ?? '')),
  })
}

export function useLatest(viewId?: string) {
  const session = useSession()
  return useQuery({ queryKey: qk.homeLatest(viewId ?? ''), queryFn: () => getLatest(session, viewId!), enabled: !!viewId })
}

function WideRow({ title, rowKey, items, focus }: { title: string; rowKey: string; items?: BaseItem[]; focus: FocusMemory }) {
  if (!items?.length) return null
  return (
    <Row
      title={title}
      className="mt-6"
      data={items}
      itemWidth={WIDE}
      keyExtractor={(item) => item.Id}
      renderItem={(item) => {
        const key = `${rowKey}:${item.Id}`
        return <MediaCard item={item} preferredFocus={focus.preferred(key)} onPress={() => focus.remember(key)} />
      }}
    />
  )
}

function LatestRow({ view, focus }: { view: UserView; focus: FocusMemory }) {
  const session = useSession()
  const { data } = useLatest(view.Id)
  if (!data?.length) return null
  return (
    <Row
      title={`Zuletzt hinzugefügt: ${view.Name}`}
      className="mt-6"
      data={data}
      itemWidth={POSTER}
      keyExtractor={(item) => item.Id}
      renderItem={(item) => {
        const key = `latest:${item.Id}`
        // Single new episodes come back as episodes; show the series poster for them.
        const card = { ...fromJellyfin(session, item), poster: seriesPosterUrl(session, item) }
        return <PosterCard item={card} preferredFocus={focus.preferred(key)} onPress={() => focus.remember(key)} />
      }}
    />
  )
}

/** Weiterschauen, Nächste Folgen and the newest titles per library. Empty rows are left out. */
export function HomeRows({ focus }: { focus: FocusMemory }) {
  const session = useSession()
  const resume = useResume()
  const nextUp = useQuery({ queryKey: qk.homeNextUp, queryFn: () => getNextUp(session) })
  const views = useLibraryViews()

  return (
    <View>
      <WideRow title="Weiterschauen" rowKey="resume" items={resume.data} focus={focus} />
      <WideRow title="Nächste Folgen" rowKey="next" items={nextUp.data} focus={focus} />
      {views.data?.map((view) => (
        <LatestRow key={view.Id} view={view} focus={focus} />
      ))}
    </View>
  )
}
