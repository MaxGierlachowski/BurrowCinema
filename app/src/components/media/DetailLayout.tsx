import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useState, type ReactElement, type ReactNode } from 'react'
import { FlatList, ScrollView, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@shared/theme'
import { Poster } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'

type Props = {
  title: string
  backdrop?: string
  poster?: string
  logo?: string
  meta: (string | undefined)[]
  genres?: string[]
  tagline?: string
  overview?: string
  badges?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

/** Same as the web: 38% of the screen height, at least 14rem. */
function useBackdropHeight() {
  const { height } = useWindowDimensions()
  return Math.max(height * 0.38, 224)
}

export function BackButton() {
  const insets = useSafeAreaInsets()
  return (
    <Button
      variant="secondary"
      size="icon"
      icon={ArrowLeft}
      accessibilityLabel="Zurück"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      className="absolute left-4 z-10 rounded-full bg-black/40"
      style={{ top: insets.top + 8 }}
    />
  )
}

function Title({ title, logo }: { title: string; logo?: string }) {
  const [failed, setFailed] = useState(false)
  if (logo && !failed) {
    return (
      <Image
        source={logo}
        contentFit="contain"
        contentPosition="left"
        onError={() => setFailed(true)}
        accessibilityLabel={title}
        style={{ height: 56, width: '100%' }}
      />
    )
  }
  return <Text className="text-2xl leading-tight font-bold tracking-tight">{title}</Text>
}

export function DetailLayout(props: Props) {
  const { title, backdrop, poster, logo, meta, genres, tagline, overview, badges, actions, children } = props
  const insets = useSafeAreaInsets()
  const height = useBackdropHeight()

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View className="overflow-hidden" style={{ height }}>
          {backdrop && <Image source={backdrop} contentFit="cover" contentPosition="top" transition={200} style={{ width: '100%', height: '100%' }} />}
          <LinearGradient
            colors={[`${colors.background}00`, `${colors.background}80`, colors.background]}
            style={{ position: 'absolute', inset: 0 }}
          />
        </View>

        <View className="-mt-28 flex-row gap-x-4 px-4">
          <View className="aspect-[2/3] w-28 overflow-hidden rounded-xl border border-white/10 bg-muted">
            <Poster src={poster} title={title} />
          </View>
          <View className="min-w-0 flex-1 gap-2 self-end">
            <Title title={title} logo={logo} />
            <Text className="text-sm text-muted-foreground">{meta.filter(Boolean).join(' · ')}</Text>
            {badges && <View className="flex-row flex-wrap gap-1.5">{badges}</View>}
          </View>
        </View>

        <View className="mt-6 gap-5 px-4">
          {actions && <View className="flex-row flex-wrap gap-2">{actions}</View>}
          {!!genres?.length && (
            <View className="flex-row flex-wrap gap-1.5">
              {genres.map((g) => (
                <Badge key={g} variant="outline">
                  {g}
                </Badge>
              ))}
            </View>
          )}
          {tagline && <Text className="text-lg text-foreground/90 italic">{tagline}</Text>}
          {overview && <Text className="leading-relaxed text-muted-foreground">{overview}</Text>}
        </View>

        <View className="px-4">{children}</View>
      </ScrollView>
      <BackButton />
    </View>
  )
}

export function DetailSkeleton() {
  const height = useBackdropHeight()
  return (
    <View className="flex-1 bg-background">
      <View style={{ height }}>
        <Skeleton className="size-full rounded-none" />
      </View>
      <View className="-mt-28 flex-row gap-4 px-4">
        <Skeleton className="aspect-[2/3] w-28 rounded-xl" />
        <View className="flex-1 gap-3 self-end">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </View>
      </View>
      <BackButton />
    </View>
  )
}

/** Error or not found state of a detail screen, with a way back. */
export function DetailMessage({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-background px-4" style={{ paddingTop: insets.top + 64 }}>
      {children}
      <BackButton />
    </View>
  )
}

type RowProps<T> = {
  title: string
  data: T[]
  itemWidth: number
  keyExtractor: (item: T) => string
  renderItem: (item: T) => ReactElement
}

const GAP = 12

/** Horizontal, snapping list with a heading, like the web Row. */
export function Row<T>({ title, data, itemWidth, keyExtractor, renderItem }: RowProps<T>) {
  return (
    <View className="mt-10">
      <Text className="mb-3 text-lg font-semibold">{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => <View style={{ width: itemWidth }}>{renderItem(item)}</View>}
        showsHorizontalScrollIndicator={false}
        snapToInterval={itemWidth + GAP}
        decelerationRate="fast"
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: GAP }}
      />
    </View>
  )
}
