import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { ChartColumn, Plus, Server } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { describeStatus, getDrawServer, listDraws, TYPE_LABEL, type DrawStatus, type DrawSummary } from '@shared/draws'
import { plural } from '@shared/format'
import { useSession } from '@shared/hooks/useAuth'
import { colors } from '@shared/theme'
import { BurrowMark } from '@/components/BurrowMark'
import { ProgressBar, SectionTitle } from '@/components/draws/DrawParts'
import { useManualRefresh } from '@/components/draws/useManualRefresh'
import { EmptyState } from '@/components/EmptyState'
import { Poster } from '@/components/PosterCard'
import { PageHeader, Screen } from '@/components/Screen'
import { DRAW_SERVER_HINT, DrawServerForm } from '@/components/settings/DrawServerForm'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { SheetInput } from '@/components/ui/sheet-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { registerBackgroundCheck } from '@/lib/backgroundTask'
import { haptic } from '@/lib/haptics'
import { askOnce, onDrawsFetched } from '@/lib/notifications'

const SECTIONS: { status: DrawStatus; title: string }[] = [
  { status: 'running', title: 'Laufend' },
  { status: 'scheduled', title: 'Geplant' },
  { status: 'ended', title: 'Beendet' },
]

/** Up to three posters fanned out like a hand of cards. */
function PosterStack({ posters }: { posters: string[] }) {
  if (!posters.length) {
    return (
      <View className="size-full items-center justify-center rounded-lg bg-muted">
        <BurrowMark size={32} color={colors.mutedForeground} />
      </View>
    )
  }
  return posters.map((src, i) => (
    <View
      key={src}
      className="absolute top-0 h-24 w-16 overflow-hidden rounded-md border border-black/40"
      style={{ left: i * 6, transform: [{ rotate: `${(i - 1) * 5}deg` }], zIndex: 3 - i }}
    >
      <Poster src={src} title="" />
    </View>
  ))
}

function DrawCard({ draw, userId }: { draw: DrawSummary; userId: string }) {
  const mine = draw.participants.find((p) => p.id === userId)?.swiped ?? 0
  return (
    <Pressable
      onPress={() => {
        haptic.tap()
        router.push(`/draws/${draw.id}`)
      }}
      className="flex-row gap-4 rounded-xl border border-border bg-card p-3 active:border-primary/50"
    >
      <View className="h-24 w-20 shrink-0">
        <PosterStack posters={draw.posters} />
      </View>
      <View className="min-w-0 flex-1 gap-1 self-center">
        <Text className="font-semibold" numberOfLines={1}>
          {draw.title}
        </Text>
        <Text className="text-sm text-muted-foreground">{describeStatus(draw)}</Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {plural(draw.itemCount, 'Titel', 'Titel')} · {TYPE_LABEL[draw.itemType]} · {plural(draw.participants.length, 'Person', 'Personen')}
        </Text>
        {draw.status === 'running' && <ProgressBar value={draw.itemCount ? mine / draw.itemCount : 0} className="mt-2" />}
      </View>
    </Pressable>
  )
}

function ConnectServer({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="lg" icon={Server} onPress={() => setOpen(true)}>
        Server verbinden
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Auslosung Server verbinden" description={DRAW_SERVER_HINT}>
        <DrawServerForm
          InputComponent={SheetInput}
          onChange={() => {
            setOpen(false)
            onConnected()
          }}
        />
      </Sheet>
    </>
  )
}

const newDraw = () => router.push('/draws/new')

export default function Draws() {
  const session = useSession()
  const [server, setServer] = useState(getDrawServer)
  const query = useQuery({
    queryKey: ['draws'],
    queryFn: async () => {
      const draws = await listDraws(session)
      onDrawsFetched(session.userId, draws)
      return draws
    },
    enabled: !!server,
    refetchInterval: 60_000,
  })
  const { refreshing, onRefresh } = useManualRefresh(query.refetch)
  const draws = query.data ?? []

  // First visit of the tab: ask for notifications, then keep reminders up to date in the background.
  useEffect(() => {
    askOnce()
      .then((granted) => {
        if (granted) registerBackgroundCheck()
      })
      .catch(() => undefined)
  }, [])

  if (!server) {
    return (
      <Screen className="px-4">
        <PageHeader title="Auslosung" />
        <EmptyState
          icon={BurrowMark}
          title="Gemeinsam aussuchen"
          text="Lade andere ein, swiped durch Filme und Serien und findet heraus, worauf alle Lust haben. Dafür braucht es den BurrowCinema Server."
        >
          <ConnectServer onConnected={() => setServer(getDrawServer())} />
        </EmptyState>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-4 pb-8"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.card} />}
      >
        <PageHeader title="Auslosung" subtitle="Swipen und gemeinsam entscheiden">
          <View className="flex-row gap-2">
            <Button size="icon-lg" variant="secondary" icon={ChartColumn} accessibilityLabel="Statistik" onPress={() => router.push('/draws/stats')} />
            <Button size="lg" icon={Plus} onPress={newDraw}>
              Neu
            </Button>
          </View>
        </PageHeader>

        {query.isLoading && (
          <View className="gap-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-30 rounded-xl" />
            ))}
          </View>
        )}
        {query.isError && <EmptyState icon={BurrowMark} title="Server nicht erreichbar" text={query.error.message} />}
        {query.isSuccess && draws.length === 0 && (
          <EmptyState icon={BurrowMark} title="Noch keine Auslosungen" text="Leg die erste an und lade jemanden ein.">
            <Button size="lg" icon={Plus} onPress={newDraw}>
              Neue Auslosung
            </Button>
          </EmptyState>
        )}

        <View className="gap-8">
          {SECTIONS.map(({ status, title }) => {
            const list = draws.filter((d) => d.status === status)
            if (!list.length) return null
            return (
              <View key={status}>
                <SectionTitle>{title}</SectionTitle>
                <View className="gap-3">
                  {list.map((draw) => (
                    <DrawCard key={draw.id} draw={draw} userId={session.userId} />
                  ))}
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </Screen>
  )
}
