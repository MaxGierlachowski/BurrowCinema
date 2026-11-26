import { router, useLocalSearchParams, type Href } from 'expo-router'
import { FolderOpen, Search } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'
import type { Folder, FolderItem } from '@shared/folders'
import { plural } from '@shared/format'
import { useFolders } from '@shared/hooks/useFolders'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { FolderActionsSheet } from '@/components/folders/FolderActionsSheet'
import { FolderHeader } from '@/components/folders/FolderHeader'
import { NameSheet } from '@/components/folders/NameSheet'
import { RemoveButton } from '@/components/folders/RemoveButton'
import { Segmented } from '@/components/folders/Segmented'
import { PosterCard, PosterGrid, PosterGridSkeleton } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Filter = 'all' | 'movie' | 'series' | 'missing'

const FILTERS: Record<Filter, { label: string; test: (i: FolderItem) => boolean }> = {
  all: { label: 'Alle', test: () => true },
  movie: { label: 'Filme', test: (i) => i.type === 'movie' },
  series: { label: 'Serien', test: (i) => i.type === 'series' },
  missing: { label: 'Fehlt', test: (i) => i.source !== 'jellyfin' },
}

const FILTER_OPTIONS = (Object.keys(FILTERS) as Filter[]).map((value) => ({
  value,
  label: FILTERS[value].label,
}))

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/folders' as Href))

function Frame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {children}
    </View>
  )
}

export default function FolderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { folders, isLoading, rename, remove, restore, toggleItem } = useFolders()
  const [filter, setFilter] = useState<Filter>('all')
  const [actionsOpen, setActionsOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  // Keeps the screen filled while it slides away after deleting.
  const [deleted, setDeleted] = useState<Folder>()
  const folder = folders.find((f) => f.id === id) ?? deleted

  if (isLoading) {
    return (
      <Frame>
        <FolderHeader onBack={goBack} />
        <PosterGridSkeleton />
      </Frame>
    )
  }

  if (!folder) {
    return (
      <Frame>
        <FolderHeader onBack={goBack} />
        <View className="px-4">
          <EmptyState icon={BurrowMark} title="Dieser Gang führt nirgendwohin" text="Den Ordner gibt es nicht mehr.">
            <Button variant="secondary" onPress={() => router.replace('/folders' as Href)}>
              Zu den Ordnern
            </Button>
          </EmptyState>
        </View>
      </Frame>
    )
  }

  const deleteFolder = () => {
    setDeleted(folder)
    remove(folder.id)
    goBack()
    toast(`„${folder.name}“ gelöscht`, {
      action: { label: 'Rückgängig', onClick: () => restore(folder) },
    })
  }

  const removeItem = (item: FolderItem) => {
    toggleItem(folder.id, item)
    toast(`${item.title} entfernt`, {
      action: {
        label: 'Rückgängig',
        onClick: () => toggleItem(folder.id, item),
      },
    })
  }

  const items = [...folder.items].reverse().filter(FILTERS[filter].test)
  const missing = folder.items.filter(FILTERS.missing.test).length
  const subtitle = `${plural(folder.items.length, 'Titel', 'Titel')}${missing ? `, ${missing} noch nicht geladen` : ''}`

  return (
    <Frame>
      <FolderHeader title={folder.name} subtitle={subtitle} onBack={goBack} onActions={() => setActionsOpen(true)} />

      <PosterGrid
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          folder.items.length > 0 ? (
            <View className="px-1.5 pb-5">
              <Segmented options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          folder.items.length === 0 ? (
            <View className="px-1.5">
              <EmptyState
                icon={FolderOpen}
                title="Dieser Ordner ist leer"
                text="Öffne einen Film oder eine Serie und tippe auf „Zu Ordner hinzufügen“."
              >
                <Button variant="secondary" icon={Search} onPress={() => router.push('/search' as Href)}>
                  Titel suchen
                </Button>
              </EmptyState>
            </View>
          ) : null
        }
        renderItem={(item) => (
          <PosterCard
            item={item}
            badge={
              item.source !== 'jellyfin' && (
                <Badge variant="secondary" className="bg-black/70">
                  Nicht geladen
                </Badge>
              )
            }
            action={<RemoveButton title={item.title} onPress={() => removeItem(item)} />}
          />
        )}
      />

      <FolderActionsSheet
        title={folder.name}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        onRename={() => setRenaming(true)}
        onDelete={deleteFolder}
      />
      <NameSheet
        title="Ordner umbenennen"
        confirmLabel="Speichern"
        initial={folder.name}
        open={renaming}
        onOpenChange={setRenaming}
        onSubmit={(name) => rename(folder.id, name)}
      />
    </Frame>
  )
}
