import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { fromJellyfin } from '@shared/folders'
import { useSession } from '@shared/hooks/useAuth'
import { getItems, type ItemType, type SortKey } from '@shared/jellyfin'
import { colors } from '@shared/theme'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { OptionList } from '@/components/media/OptionList'
import { Segmented } from '@/components/media/Segmented'
import { PosterCard, PosterGrid, PosterGridSkeleton } from '@/components/PosterCard'
import { PageHeader, Screen } from '@/components/Screen'
import { Icon } from '@/components/ui/icon'
import { Sheet } from '@/components/ui/sheet'
import { Text } from '@/components/ui/text'

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

function SortPicker({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable
        accessibilityLabel="Sortierung"
        onPress={() => setOpen(true)}
        className="h-10 w-40 flex-row items-center justify-between gap-2 rounded-lg border border-input bg-input/30 px-3 active:opacity-80"
      >
        <Text className="shrink text-sm" numberOfLines={1}>
          {SORTS[value]}
        </Text>
        <Icon as={ChevronDown} size={16} color="mutedForeground" />
      </Pressable>
      <Sheet open={open} onOpenChange={setOpen} title="Sortierung">
        <OptionList
          value={value}
          options={Object.entries(SORTS).map(([key, label]) => ({ value: key, label }))}
          onChange={(key) => {
            onChange(key as SortKey)
            setOpen(false)
          }}
        />
      </Sheet>
    </>
  )
}

export default function Library() {
  const session = useSession()
  const [type, setType] = useState<ItemType>('Movie')
  const [sort, setSort] = useState<SortKey>('DateCreated')
  const [refreshing, setRefreshing] = useState(false)

  const query = useInfiniteQuery({
    queryKey: ['items', type, sort],
    queryFn: ({ pageParam }) => getItems(session, { type, sort, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.Items.length, 0)
      return loaded < last.TotalRecordCount ? loaded : undefined
    },
  })

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.Items.map((item) => fromJellyfin(session, item))) ?? [], [query.data, session])
  const total = query.data?.pages[0]?.TotalRecordCount

  const refresh = async () => {
    setRefreshing(true)
    await query.refetch()
    setRefreshing(false)
  }

  const header = (
    <View className="px-1.5">
      <PageHeader title="Bibliothek" subtitle={total !== undefined ? `${total} Titel` : undefined}>
        <View className="w-full flex-row gap-2">
          <Segmented value={type} onChange={setType} options={TYPES} className="flex-1" />
          <SortPicker value={sort} onChange={setSort} />
        </View>
      </PageHeader>
    </View>
  )

  const empty = query.isLoading ? (
    <View className="-mx-2.5">
      <PosterGridSkeleton />
    </View>
  ) : (
    <View className="px-1.5">
      {query.isError && <EmptyState icon={BurrowMark} title="Bibliothek konnte nicht geladen werden" text={query.error.message} />}
      {query.isSuccess && <EmptyState icon={BurrowMark} title="Der Bau ist noch leer" />}
    </View>
  )

  return (
    <Screen>
      <PosterGrid
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={(item) => <PosterCard item={item} />}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.card} />}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </Screen>
  )
}
