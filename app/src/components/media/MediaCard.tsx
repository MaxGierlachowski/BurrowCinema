import { router } from 'expo-router'
import { CheckCircle2 } from 'lucide-react-native'
import { memo } from 'react'
import { View } from 'react-native'
import { useSession } from '@shared/hooks/useAuth'
import { thumbUrl, type BaseItem } from '@shared/jellyfin'
import { Poster } from '@/components/PosterCard'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { itemHref, personHref } from '@/lib/routes'
import { Focusable } from '@/lib/tv'
import { cn } from '@/lib/utils'

/** "S1:F2" for episodes, undefined otherwise. */
export function episodeCode(item: BaseItem) {
  if (item.Type !== 'Episode' || item.IndexNumber === undefined) return undefined
  return `S${item.ParentIndexNumber ?? 1}:F${item.IndexNumber}`
}

/** Watched share in percent while an item is in progress, otherwise undefined. */
export function progressPercent(item: BaseItem) {
  const data = item.UserData
  if (!data?.PlaybackPositionTicks || data.Played) return undefined
  return data.PlayedPercentage ?? (item.RunTimeTicks ? (data.PlaybackPositionTicks / item.RunTimeTicks) * 100 : undefined)
}

export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <View className={cn('h-1 overflow-hidden rounded-full bg-white/20', className)}>
      <View className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(2, percent))}%` }} />
    </View>
  )
}

/** Landscape still with progress, played mark and an optional overlay in the corner. */
export function Thumb({ item, className }: { item: BaseItem; className?: string }) {
  const session = useSession()
  const percent = progressPercent(item)
  return (
    <View className={cn('aspect-video overflow-hidden rounded-lg border border-border bg-muted', className)}>
      <Poster src={thumbUrl(session, item, 600)} title={item.SeriesName ?? item.Name} />
      {item.UserData?.Played && (
        <View accessibilityLabel="Gesehen" className="absolute top-1.5 right-1.5 rounded-full bg-black/60">
          <Icon as={CheckCircle2} size={18} color="primary" />
        </View>
      )}
      {percent !== undefined && <ProgressBar percent={percent} className="absolute right-2 bottom-2 left-2" />}
    </View>
  )
}

type Props = { item: BaseItem; preferredFocus?: boolean; onPress?: () => void }

/** Landscape card for Continue Watching and Next Up: still, progress bar, title and episode line. */
export const MediaCard = memo(function MediaCard({ item, preferredFocus, onPress }: Props) {
  const code = episodeCode(item)
  const title = item.Type === 'Episode' ? (item.SeriesName ?? item.Name) : item.Name
  const subtitle = code ? `${code} · ${item.Name}` : item.ProductionYear?.toString()
  return (
    <Focusable
      accessibilityLabel={title}
      preferredFocus={preferredFocus}
      onPress={() => {
        haptic.tap()
        onPress?.()
        router.push(itemHref(item.Id))
      }}
      className="rounded-lg"
    >
      <Thumb item={item} />
      <Text className="mt-1.5 text-sm font-medium" numberOfLines={1}>
        {title}
      </Text>
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
        {subtitle ?? ' '}
      </Text>
    </Focusable>
  )
})

type PersonProps = { id: string; name: string; role?: string; image?: string }

/** Round photo with name and role; opens the person page. */
export function PersonCard({ id, name, role, image }: PersonProps) {
  return (
    <Focusable accessibilityLabel={name} onPress={() => router.push(personHref(id))} className="items-center rounded-lg">
      <View className="aspect-square w-full overflow-hidden rounded-full border border-white/10 bg-muted">
        <Poster
          src={image}
          title={name
            .split(' ')
            .map((w) => w[0])
            .join('')}
        />
      </View>
      <Text className="mt-1.5 text-center text-xs font-medium" numberOfLines={2}>
        {name}
      </Text>
      {!!role && (
        <Text className="text-center text-[11px] text-muted-foreground" numberOfLines={1}>
          {role}
        </Text>
      )}
    </Focusable>
  )
}
