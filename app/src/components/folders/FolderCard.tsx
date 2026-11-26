import { router, type Href } from 'expo-router'
import { FolderHeart } from 'lucide-react-native'
import { memo } from 'react'
import { Pressable, View } from 'react-native'
import type { Folder, FolderItem } from '@shared/folders'
import { plural } from '@shared/format'
import { Poster } from '@/components/PosterCard'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'

function Cover({ item }: { item?: FolderItem }) {
  return <View className="flex-1 overflow-hidden">{item && <Poster src={item.poster} title={item.title} />}</View>
}

/** 2x2 collage of the four most recently added posters, like the web folder card. */
function Collage({ items }: { items: FolderItem[] }) {
  const covers = items.slice(-4).reverse()
  if (covers.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <Icon as={FolderHeart} color="mutedForeground" size={40} />
      </View>
    )
  }
  return (
    <View className="flex-1 gap-0.5">
      {[0, 2].map((row) => (
        <View key={row} className="flex-1 flex-row gap-0.5">
          <Cover item={covers[row]} />
          <Cover item={covers[row + 1]} />
        </View>
      ))}
    </View>
  )
}

export const FolderCard = memo(function FolderCard({ folder }: { folder: Folder }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap()
        router.push(`/folders/${folder.id}` as Href)
      }}
      className="active:opacity-80"
    >
      <View className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
        <Collage items={folder.items} />
      </View>
      <Text className="mt-2 font-medium" numberOfLines={1}>
        {folder.name}
      </Text>
      <Text className="text-xs text-muted-foreground">{plural(folder.items.length, 'Titel', 'Titel')}</Text>
    </Pressable>
  )
})
