import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react-native'
import { useMemo, useState, type ReactElement } from 'react'
import { RefreshControl, View } from 'react-native'
import { fromJellyfin } from '@shared/folders'
import { useSession } from '@shared/hooks/useAuth'
import { getItems, type ItemFilter, type ItemType, type SortKey } from '@shared/jellyfin'
import { load, save } from '@shared/storage'
import { colors } from '@shared/theme'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { OptionList } from '@/components/media/OptionList'
import { Segmented } from '@/components/media/Segmented'
import { PosterCard, PosterGrid, PosterGridSkeleton } from '@/components/PosterCard'
import { PageHeader } from '@/components/Screen'
import { Icon } from '@/components/ui/icon'
import { Sheet } from '@/components/ui/sheet'
import { Text } from '@/components/ui/text'
import { Focusable, isTV, useFocusMemory } from '@/lib/tv'

const SORTS: Record<SortKey, string> = {
  DateCreated: 'Neu hinzugefügt',
  SortName: 'Name',
  ProductionYear: 'Erscheinungsjahr',
  CommunityRating: 'Bewertung',
}

const TYPES: { value: ItemType; label: string }[] = [
  { value: 'Movie', label: 'Filme' },
  { value: 'Series', label: 'Serien' },
]

type Status = 'all' | ItemFilter

const STATUS: { value: Status; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'IsUnplayed', label: 'Ungesehen' },
  { value: 'IsPlayed', label: 'Gesehen' },
  { value: 'IsFavorite', label: 'Favoriten' },
]

type Prefs = { sort: SortKey; status: Status }

/** Sort and status filter, remembered per library type. Unknown stored values fall back to the defaults. */
function loadPrefs(type: ItemType): Prefs {
  const stored = load<Partial<Prefs>>(`bc.library.${type}`, {})
  return {
    sort: stored.sort && Object.hasOwn(SORTS, stored.sort) ? stored.sort : 'DateCreated',
    status: STATUS.find((s) => s.value === stored.status)?.value ?? 'all',
  }
}

function SortPicker({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const options = Object.entries(SORTS).map(([key, label]) => ({ value: key as SortKey, label }))
  // No sheet on TV: the options are shown inline and reachable with the D pad.
  if (isTV) return <Segmented value={value} onChange={onChange} options={options} className="flex-1" />
  return (
    <>
      <Focusable
        accessibilityLabel="Sortierung"
        onPress={() => setOpen(true)}
        className="h-11 w-40 flex-row items-center justify-between gap-2 rounded-lg border border-input bg-input/30 px-3"
      >
        <Text className="shrink text-sm" numberOfLines={1}>
          {SORTS[value]}
        </Text>
        <Icon as={ChevronDown} size={16} color="mutedForeground" />
      </Focusable>
      <Sheet open={open} onOpenChange={setOpen} title="Sortierung">
        <OptionList
          value={value}
          options={options}
          onChange={(key) => {
            onChange(key as SortKey)
            setOpen(false)
          }}
        />
      </Sheet>
    </>
  )
}

type Props = {
  title: string
  type: ItemType
  /** Shows the Filme/Serien switch. Without it the grid stays on one type (library route). */
  onTypeChange?: (type: ItemType) => void
  /** Content between the page header and the grid controls, e.g. the home rows. */
  rows?: ReactElement
  paddingBottom?: number
  /** TV: the first poster takes the focus when the screen opens (pushed library route). */
  focusFirst?: boolean
}

/** Poster grid of the whole library with sorting, status filter, endless loading and pull to refresh. */
export function LibraryGrid({ title, type, onTypeChange, rows, paddingBottom = 24, focusFirst }: Props) {
  const session = useSession()
  const client = useQueryClient()
  const [prefs, setPrefs] = useState(() => loadPrefs(type))
  const [prefsType, setPrefsType] = useState(type)
  if (prefsType !== type) {
    // The Filme/Serien switch changes the type in place: load that library's choice.
    setPrefsType(type)
    setPrefs(loadPrefs(type))
  }
  const { sort, status } = prefs
  const [refreshing, setRefreshing] = useState(false)
  const filters = status === 'all' ? undefined : status
  const focus = useFocusMemory(`library:${type}`)
  // Until the user picks a card or changes the sort or filter; afterwards the focus memory decides.
  const [initialFocus, setInitialFocus] = useState(!!focusFirst)
  const changePrefs = (change: Partial<Prefs>) => {
    setInitialFocus(false)
    const next = { ...prefs, ...change }
    setPrefs(next)
    save(`bc.library.${type}`, next)
  }
  const setSort = (sort: SortKey) => changePrefs({ sort })
  const setStatus = (status: Status) => changePrefs({ status })

  const query = useInfiniteQuery({
    queryKey: ['items', type, sort, status],
    queryFn: ({ pageParam }) => getItems(session, { type, sort, filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.Items.length, 0)
      return loaded < last.TotalRecordCount ? loaded : undefined
    },
  })

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.Items.map((item) => fromJellyfin(session, item))) ?? [],
    [query.data, session],
  )
  const total = query.data?.pages[0]?.TotalRecordCount

  const refresh = async () => {
    setRefreshing(true)
    // The home rows above the grid are refreshed by the same pull.
    await Promise.all([query.refetch(), rows ? client.invalidateQueries({ queryKey: ['home'] }) : undefined])
    setRefreshing(false)
  }

  const controls = (
    <View className={onTypeChange || isTV ? 'w-full flex-row gap-2' : 'flex-row'}>
      {onTypeChange && <Segmented value={type} onChange={onTypeChange} options={TYPES} className="flex-1" />}
      <SortPicker value={sort} onChange={setSort} />
    </View>
  )

  const header = (
    <View className="gap-2 px-1.5 pb-5">
      <PageHeader title={title} subtitle={total !== undefined ? `${total} Titel` : undefined}>
        {!rows && controls}
      </PageHeader>
      {rows && <View className="-mt-5 mb-8">{rows}</View>}
      {rows && controls}
      <Segmented value={status} onChange={setStatus} options={STATUS} />
    </View>
  )

  const empty = query.isLoading ? (
    <View className="-mx-2.5">
      <PosterGridSkeleton />
    </View>
  ) : (
    <View className="px-1.5">
      {query.isError && <EmptyState icon={BurrowMark} title="Bibliothek konnte nicht geladen werden" text={query.error.message} />}
      {query.isSuccess && (
        <EmptyState icon={BurrowMark} title={status === 'all' ? 'Der Bau ist noch leer' : 'Nichts passt zu diesem Filter'} />
      )}
    </View>
  )

  return (
    <PosterGrid
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={(item) => (
        <PosterCard
          item={item}
          preferredFocus={focus.preferred(item.key) || (initialFocus && item.key === items[0]?.key)}
          onPress={() => {
            setInitialFocus(false)
            focus.remember(item.key)
          }}
        />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <View className="-mx-2.5">
            <PosterGridSkeleton count={6} />
          </View>
        ) : null
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage()
      }}
      onEndReachedThreshold={1}
      refreshControl={
        isTV ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        )
      }
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom }}
    />
  )
}
