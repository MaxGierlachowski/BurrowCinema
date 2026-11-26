import { FlashList } from '@shopify/flash-list'
import { FolderHeart, Plus } from 'lucide-react-native'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useFolders } from '@shared/hooks/useFolders'
import { EmptyState } from '@/components/EmptyState'
import { FolderCard } from '@/components/folders/FolderCard'
import { NameSheet } from '@/components/folders/NameSheet'
import { PageHeader, Screen } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function useFolderColumns() {
  const { width } = useWindowDimensions()
  return width < 600 ? 2 : 3
}

function FoldersSkeleton({ columns }: { columns: number }) {
  return (
    <View className="flex-row flex-wrap">
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} className="px-2 pb-4" style={{ width: `${100 / columns}%` }}>
          <Skeleton className="aspect-square rounded-xl" />
        </View>
      ))}
    </View>
  )
}

export default function Folders() {
  const { folders, isLoading, create } = useFolders()
  const [creating, setCreating] = useState(false)
  const columns = useFolderColumns()

  const createButton = (
    <Button size="lg" icon={Plus} onPress={() => setCreating(true)}>
      Neuer Ordner
    </Button>
  )

  return (
    <Screen>
      <FlashList
        data={isLoading ? [] : folders}
        key={columns}
        numColumns={columns}
        keyExtractor={(folder) => folder.id}
        renderItem={({ item }) => (
          <View className="px-2 pb-4">
            <FolderCard folder={item} />
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="px-2">
            <PageHeader title="Ordner" subtitle="Eigene Sammlungen, auch mit Titeln, die noch fehlen">
              {folders.length > 0 && createButton}
            </PageHeader>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <FoldersSkeleton columns={columns} />
          ) : (
            <View className="px-2">
              <EmptyState
                icon={FolderHeart}
                title="Noch keine Ordner"
                text="Leg einen Ordner an, zum Beispiel „Filmabend“ oder „Watchlist“, und füge Titel über ihre Detailseite hinzu."
              >
                {createButton}
              </EmptyState>
            </View>
          )
        }
      />
      <NameSheet title="Neuer Ordner" confirmLabel="Anlegen" open={creating} onOpenChange={setCreating} onSubmit={(name) => create(name)} />
    </Screen>
  )
}
