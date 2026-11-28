import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Search as SearchIcon, X } from 'lucide-react-native'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { ARR_LABEL, getArrSettings, searchArr, type ArrKind } from '@shared/arr'
import { fromArr, fromJellyfin } from '@shared/folders'
import { useSession } from '@shared/hooks/useAuth'
import { getItems, posterUrl, searchPeople } from '@shared/jellyfin'
import { colors } from '@shared/theme'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { Row } from '@/components/media/DetailLayout'
import { MediaCard, PersonCard } from '@/components/media/MediaCard'
import { WrapGrid } from '@/components/media/WrapGrid'
import { PosterCard, PosterGridSkeleton } from '@/components/PosterCard'
import { Screen } from '@/components/Screen'
import { ArrForm, ARR_HINT } from '@/components/settings/ArrForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { SheetInput } from '@/components/ui/sheet-input'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { isTV } from '@/lib/tv'

function useDebounced(value: string, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-8">
      <Text className="mb-3 text-lg font-semibold">{title}</Text>
      {children}
    </View>
  )
}

function Skeletons() {
  return (
    <View className="-mx-4">
      <PosterGridSkeleton count={6} />
    </View>
  )
}

/** Inline, tappable product name inside a sentence; opens the connection sheet. */
function ArrLink({ kind, connected, onPress }: { kind: ArrKind; connected: boolean; onPress: (kind: ArrKind) => void }) {
  return (
    <Text
      accessibilityRole="link"
      onPress={() => {
        haptic.tap()
        onPress(kind)
      }}
      className="text-sm font-medium text-primary underline"
    >
      {ARR_LABEL[kind]}
      {connected && ' '}
      {connected && <CheckCircle2 size={14} color={colors.like} />}
    </Text>
  )
}

function ArrSheet({ kind, open, onOpenChange, onChange }: { kind: ArrKind; open: boolean; onOpenChange: (open: boolean) => void; onChange: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`${ARR_LABEL[kind]} verbinden`} description={ARR_HINT(kind)}>
      <ArrForm
        key={kind}
        kind={kind}
        InputComponent={SheetInput}
        onChange={() => {
          onOpenChange(false)
          onChange()
        }}
      />
    </Sheet>
  )
}

/** Episodes and people matching the term; each row only shows up when there are hits. */
function MoreResults({ term }: { term: string }) {
  const session = useSession()
  const episodes = useQuery({
    queryKey: ['search-episodes', term],
    queryFn: () => getItems(session, { type: 'Episode', search: term, limit: 20 }),
  })
  const people = useQuery({ queryKey: ['search-people', term], queryFn: () => searchPeople(session, term) })
  return (
    <>
      {!!episodes.data?.Items.length && (
        <Row
          title="Folgen"
          className="mt-8"
          data={episodes.data.Items}
          itemWidth={220}
          keyExtractor={(item) => item.Id}
          renderItem={(item) => <MediaCard item={item} />}
        />
      )}
      {!!people.data?.length && (
        <Row
          title="Personen"
          className="mt-8"
          data={people.data}
          itemWidth={80}
          keyExtractor={(person) => person.Id}
          renderItem={(person) => <PersonCard id={person.Id} name={person.Name} image={posterUrl(session, person, 200)} />}
        />
      )}
    </>
  )
}

function ArrResults({ kind, term, knownIds }: { kind: ArrKind; term: string; knownIds: Set<string> }) {
  const query = useQuery({ queryKey: ['arr-search', kind, term], queryFn: () => searchArr(kind, term) })
  const results = query.data?.filter((item) => !knownIds.has(item.id)) ?? []
  const label = kind === 'radarr' ? 'Filme' : 'Serien'

  return (
    <Section title={`Nicht in der Bibliothek: ${label} (${ARR_LABEL[kind]})`}>
      {query.isLoading && <Skeletons />}
      {query.isError && (
        <Text className="text-sm text-destructive">
          {ARR_LABEL[kind]}: {query.error.message}
        </Text>
      )}
      {query.isSuccess && results.length === 0 && <Text className="text-sm text-muted-foreground">Keine weiteren Treffer.</Text>}
      <WrapGrid
        data={results.slice(0, 24)}
        keyExtractor={(item) => item.id}
        renderItem={(item) => (
          <PosterCard
            item={fromArr(item)}
            badge={
              <Badge variant="secondary" className="bg-black/70">
                {item.inArr ? 'Angefragt' : 'Nicht geladen'}
              </Badge>
            }
          />
        )}
      />
    </Section>
  )
}

export default function Search() {
  const session = useSession()
  const [input, setInput] = useState('')
  const term = useDebounced(input.trim())
  const [arr, setArr] = useState(getArrSettings)
  const [sheetKind, setSheetKind] = useState<ArrKind>('radarr')
  const [sheetOpen, setSheetOpen] = useState(false)
  const refreshArr = () => setArr(getArrSettings())
  const openArr = (kind: ArrKind) => {
    setSheetKind(kind)
    setSheetOpen(true)
  }

  const library = useQuery({
    queryKey: ['search', term],
    queryFn: () => getItems(session, { type: 'Movie,Series', search: term, limit: 40 }),
    enabled: term.length >= 2,
  })

  const items = useMemo(() => library.data?.Items ?? [], [library.data])
  const knownIds = useMemo(
    () => new Set(items.flatMap((i) => [i.ProviderIds?.Tmdb, i.ProviderIds?.Tvdb]).filter((id): id is string => !!id)),
    [items],
  )
  const searching = term.length >= 2

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4 pt-4 pb-10"
      >
        <View className="justify-center">
          <Input
            value={input}
            onChangeText={setInput}
            placeholder="Filme und Serien suchen"
            returnKeyType="search"
            autoCorrect={false}
            className="pl-11 pr-12"
          />
          <View pointerEvents="none" className="absolute left-3.5">
            <Icon as={SearchIcon} color="mutedForeground" />
          </View>
          {!!input && (
            // clearButtonMode is iOS only, so the clear button is drawn here.
            <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Suche löschen" onPress={() => setInput('')} className="absolute right-0.5" />
          )}
        </View>

        {!searching && (
          <View className="mt-8">
            <EmptyState
              icon={BurrowMark}
              title="Was möchtest du finden?"
              text={
                <>
                  Gesucht wird in deiner Jellyfin Bibliothek und, wenn eingerichtet, auch in{' '}
                  <ArrLink kind="radarr" connected={!!arr.radarr} onPress={openArr} /> und{' '}
                  <ArrLink kind="sonarr" connected={!!arr.sonarr} onPress={openArr} />.
                </>
              }
            />
            {isTV && (
              // Inline text links cannot take the remote focus, so the TV gets buttons for them.
              <View className="mt-4 flex-row justify-center gap-3">
                {(['radarr', 'sonarr'] as const).map((kind) => (
                  <Button key={kind} variant="secondary" icon={arr[kind] ? CheckCircle2 : undefined} onPress={() => openArr(kind)}>
                    {`${ARR_LABEL[kind]} verbinden`}
                  </Button>
                ))}
              </View>
            )}
          </View>
        )}

        {searching && library.isSuccess && (
          <Section title="In deiner Bibliothek">
            {items.length === 0 && <Text className="text-sm text-muted-foreground">Nichts gefunden.</Text>}
            <WrapGrid data={items} keyExtractor={(item) => item.Id} renderItem={(item) => <PosterCard item={fromJellyfin(session, item)} />} />
          </Section>
        )}
        {searching && library.isSuccess && <MoreResults term={term} />}
        {searching && library.isError && (
          <View className="mt-8">
            <EmptyState icon={BurrowMark} title="Suche fehlgeschlagen" text={library.error.message}>
              <Button variant="secondary" onPress={() => library.refetch()}>
                Erneut versuchen
              </Button>
            </EmptyState>
          </View>
        )}
        {searching && library.isLoading && (
          <View className="mt-8">
            <Skeletons />
          </View>
        )}

        {/* Wait for the library so items already downloaded can be filtered out of the Radarr/Sonarr results. */}
        {searching &&
          library.isSuccess &&
          (['radarr', 'sonarr'] as const).map((kind) => (arr[kind] ? <ArrResults key={kind} kind={kind} term={term} knownIds={knownIds} /> : null))}

        {searching && !arr.radarr && !arr.sonarr && (
          <View className="mt-8 rounded-xl border border-border bg-card p-4">
            <Text className="text-sm text-muted-foreground">
              Verbinde <ArrLink kind="radarr" connected={false} onPress={openArr} /> oder{' '}
              <ArrLink kind="sonarr" connected={false} onPress={openArr} />, um auch Titel zu finden, die noch nicht heruntergeladen sind.
            </Text>
          </View>
        )}
      </ScrollView>
      <ArrSheet kind={sheetKind} open={sheetOpen} onOpenChange={setSheetOpen} onChange={refreshArr} />
    </Screen>
  )
}
