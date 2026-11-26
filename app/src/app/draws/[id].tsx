import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FlashList } from '@shopify/flash-list'
import { router, useLocalSearchParams } from 'expo-router'
import { CircleStop, Ellipsis, PartyPopper, Trash2 } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { Alert, RefreshControl, ScrollView, View } from 'react-native'
import { toast } from 'sonner-native'
import {
  deleteDraw,
  describeStatus,
  endDraw,
  formatDate,
  getDraw,
  shuffleFor,
  swipe,
  TYPE_LABEL,
  type DrawDetail as Draw,
  type DrawItem,
} from '@shared/draws'
import { useSession } from '@shared/hooks/useAuth'
import { colors } from '@shared/theme'
import { BurrowMark } from '@/components/BurrowMark'
import { BackHeader, ParticipantList, ProgressBar, SectionTitle, useScreenPadding, VoteRowItem, type VoteRow } from '@/components/draws/DrawParts'
import { SwipeDeck } from '@/components/draws/SwipeDeck'
import { useManualRefresh } from '@/components/draws/useManualRefresh'
import { EmptyState } from '@/components/EmptyState'
import { PosterCard } from '@/components/PosterCard'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'

function rankResults(draw: Draw): VoteRow[] {
  const votes = new Map(draw.results?.map((r) => [r.key, r]))
  return draw.items
    .map((item) => ({ item, likes: votes.get(item.key)?.likes ?? 0, votes: votes.get(item.key)?.votes ?? 0 }))
    .filter((r) => r.votes > 0)
    .map((r) => ({ ...r, unanimous: r.likes === draw.participants.length }))
    .sort((a, b) => b.likes - a.likes || b.likes / b.votes - a.likes / a.votes || a.item.title.localeCompare(b.item.title))
}

/** Header of the result list: the titles everybody wants, then the heading of the ranking. */
function ResultsHeader({ rows }: { rows: VoteRow[] }) {
  const unanimous = rows.filter((r) => r.unanimous)
  if (!rows.length) return <EmptyState icon={BurrowMark} title="Keine Stimmen" text="In dieser Auslosung hat niemand geswiped." />
  return (
    <View className="gap-8">
      {unanimous.length > 0 && (
        <View>
          <SectionTitle>Darauf haben alle Lust</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-3 px-4">
            {unanimous.map(({ item }) => (
              <View key={item.key} className="w-32">
                <PosterCard item={item} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      <SectionTitle>Rangliste</SectionTitle>
    </View>
  )
}

function Swiping({ draw }: { draw: Draw }) {
  const session = useSession()
  const queryClient = useQueryClient()
  const [mine, setMine] = useState(draw.mySwipes)
  const [history, setHistory] = useState<string[]>([])
  const deck = useMemo(() => shuffleFor(draw.items, session.userId + draw.id), [draw.items, draw.id, session.userId])
  const remaining = deck.filter((item) => !(item.key in mine))

  const save = (key: string, like: boolean | null, rollback: () => void) =>
    swipe(session, draw.id, key, like)
      .then(() => queryClient.invalidateQueries({ queryKey: ['draws'] }))
      .catch((err: Error) => {
        rollback()
        toast.error(`Nicht gespeichert: ${err.message}`)
      })

  const onSwipe = (item: DrawItem, like: boolean) => {
    setMine((m) => ({ ...m, [item.key]: like }))
    setHistory((h) => [...h, item.key])
    save(item.key, like, () => setMine(({ [item.key]: _, ...rest }) => rest))
  }

  const onUndo = () => {
    const key = history.at(-1)
    if (!key) return
    const previous = mine[key]
    setHistory((h) => h.slice(0, -1))
    setMine(({ [key]: _, ...rest }) => rest)
    save(key, null, () => setMine((m) => ({ ...m, [key]: previous })))
  }

  const done = draw.items.length - remaining.length

  if (!remaining.length) {
    return (
      <EmptyState
        icon={PartyPopper}
        title="Alles bewertet"
        text={`Du hast alle ${draw.items.length} Titel geswiped. Das Ergebnis gibt es, sobald die Auslosung endet (${formatDate(draw.endsAt)}).`}
      >
        {history.length > 0 && (
          <Button variant="secondary" onPress={onUndo}>
            Letzten Swipe zurücknehmen
          </Button>
        )}
      </EmptyState>
    )
  }

  return (
    <View className="gap-3">
      <View className="w-full max-w-sm flex-row items-center gap-3 self-center">
        <ProgressBar value={done / draw.items.length} className="flex-1" />
        <Text className="text-xs text-muted-foreground">
          {done} / {draw.items.length}
        </Text>
      </View>
      <SwipeDeck items={remaining} onSwipe={onSwipe} onUndo={onUndo} canUndo={history.length > 0} />
    </View>
  )
}

function OwnerActions({ draw, onEnd, onDelete }: { draw: Draw; onEnd: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const confirmDelete = () => {
    setOpen(false)
    haptic.warning()
    Alert.alert('Auslosung löschen?', `„${draw.title}“ und alle Stimmen werden für alle Teilnehmer entfernt.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: onDelete },
    ])
  }
  return (
    <>
      <Button variant="secondary" size="icon-lg" icon={Ellipsis} accessibilityLabel="Aktionen" onPress={() => setOpen(true)} />
      <Sheet open={open} onOpenChange={setOpen} title={draw.title}>
        <View className="gap-2">
          {draw.status !== 'ended' && (
            <Button
              variant="secondary"
              size="lg"
              icon={CircleStop}
              onPress={() => {
                setOpen(false)
                onEnd()
              }}
            >
              Jetzt beenden
            </Button>
          )}
          <Button variant="destructive" size="lg" icon={Trash2} onPress={confirmDelete}>
            Löschen
          </Button>
        </View>
      </Sheet>
    </>
  )
}

export default function DrawDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const session = useSession()
  const queryClient = useQueryClient()
  const padding = useScreenPadding()
  const query = useQuery({
    queryKey: ['draw', id],
    queryFn: () => getDraw(session, id),
    refetchInterval: (q) => (q.state.data?.status === 'ended' ? false : 60_000),
  })
  const { refreshing, onRefresh } = useManualRefresh(query.refetch)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['draw', id] })
    queryClient.invalidateQueries({ queryKey: ['draws'] })
  }
  const end = useMutation({ mutationFn: () => endDraw(session, id), onSuccess: refresh, onError: (e) => toast.error(e.message) })
  const remove = useMutation({
    mutationFn: () => deleteDraw(session, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] })
      router.replace('/draws')
    },
    onError: (e) => toast.error(e.message),
  })

  const draw = query.data
  const rows = useMemo(() => (draw?.status === 'ended' ? rankResults(draw) : []), [draw])

  if (!draw) {
    return (
      <View className="flex-1 bg-background" style={padding}>
        <BackHeader title="Auslosung" />
        {query.isLoading ? (
          <Skeleton className="aspect-[2/3] w-full max-w-sm self-center rounded-2xl" />
        ) : (
          <EmptyState icon={BurrowMark} title="Dieser Gang führt nirgendwohin" text={query.error?.message} />
        )}
      </View>
    )
  }

  const header = (
    <View>
      <BackHeader title={draw.title} subtitle={`${describeStatus(draw)} · ${draw.sourceLabel} · ${TYPE_LABEL[draw.itemType]} · von ${draw.owner.name}`}>
        {draw.isOwner && <OwnerActions draw={draw} onEnd={() => end.mutate()} onDelete={() => remove.mutate()} />}
      </BackHeader>
      {draw.status === 'scheduled' && (
        <EmptyState icon={BurrowMark} title="Noch etwas Geduld" text={`Die Auslosung startet ${formatDate(draw.startsAt)}.`} />
      )}
      {draw.status === 'running' && <Swiping key={draw.id} draw={draw} />}
      {draw.status === 'ended' && <ResultsHeader rows={rows} />}
    </View>
  )

  const footer = (
    <View className="mt-10">
      <SectionTitle>Teilnehmer</SectionTitle>
      <ParticipantList participants={draw.participants} total={draw.itemCount} />
    </View>
  )

  // One virtualised list for the whole screen, so long result lists stay smooth.
  return (
    <View className="flex-1 bg-background">
      <FlashList
        data={rows}
        keyExtractor={(row) => row.item.key}
        renderItem={({ item, index }) => <VoteRowItem row={item} index={index} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={padding}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.card} />}
      />
    </View>
  )
}
