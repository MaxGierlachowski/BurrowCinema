import { FlashList, type FlashListProps } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { router, type Href } from 'expo-router'
import { Star } from 'lucide-react-native'
import { memo, useState, type ReactNode } from 'react'
import { Pressable, useWindowDimensions, View } from 'react-native'
import { itemLink, type FolderItem } from '@shared/folders'
import { colors } from '@shared/theme'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { Skeleton } from './ui/skeleton'
import { Text } from './ui/text'

export function Poster({ src, title, className }: { src?: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <View className={cn('size-full items-center justify-center bg-muted p-2', className)}>
        <Text className="text-center text-xs font-medium text-muted-foreground" numberOfLines={4}>
          {title}
        </Text>
      </View>
    )
  }
  return (
    <Image
      source={src}
      recyclingKey={src}
      cachePolicy="memory-disk"
      transition={150}
      contentFit="cover"
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', backgroundColor: colors.muted }}
      accessibilityLabel={title}
    />
  )
}

type CardProps = { item: FolderItem; badge?: ReactNode; action?: ReactNode }

export const PosterCard = memo(function PosterCard({ item, badge, action }: CardProps) {
  return (
    <View>
      <Pressable
        onPress={() => {
          haptic.tap()
          router.push(itemLink(item) as Href)
        }}
        className="active:opacity-80"
      >
        <View className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-muted">
          <Poster src={item.poster} title={item.title} />
          {badge && <View className="absolute bottom-1.5 left-1.5">{badge}</View>}
        </View>
        <Text className="mt-1.5 text-sm font-medium" numberOfLines={1}>
          {item.title}
        </Text>
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">{item.year ?? ' '}</Text>
          {!!item.rating && (
            <View className="flex-row items-center gap-0.5">
              <Star size={12} color={colors.primary} fill={colors.primary} />
              <Text className="text-xs text-muted-foreground">{item.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </Pressable>
      {action && <View className="absolute top-1.5 right-1.5">{action}</View>}
    </View>
  )
})

/** Same breakpoints as the web grid: 3 columns on phones, more on tablets. */
export function useGridColumns() {
  const { width } = useWindowDimensions()
  return width < 600 ? 3 : width < 900 ? 4 : width < 1200 ? 5 : 6
}

type GridProps<T> = Omit<FlashListProps<T>, 'numColumns' | 'renderItem'> & {
  renderItem: (item: T) => ReactNode
}

/** Virtualised poster grid; only visible posters are mounted. */
export function PosterGrid<T>({ renderItem, contentContainerStyle, ...props }: GridProps<T>) {
  const columns = useGridColumns()
  return (
    <FlashList
      numColumns={columns}
      key={columns}
      renderItem={({ item }) => <View className="px-1.5 pb-4">{renderItem(item)}</View>}
      contentContainerStyle={{ paddingHorizontal: 10, ...(contentContainerStyle as object) }}
      {...props}
    />
  )
}

export function PosterGridSkeleton({ count = 9 }: { count?: number }) {
  const columns = useGridColumns()
  return (
    <View className="flex-row flex-wrap px-2.5">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="px-1.5 pb-4" style={{ width: `${100 / columns}%` }}>
          <Skeleton className="aspect-[2/3] rounded-lg" />
          <Skeleton className="mt-2 h-3 w-3/4" />
        </View>
      ))}
    </View>
  )
}
