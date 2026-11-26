import { router, type Href } from 'expo-router'
import { memo, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import type { DrawItem, Participant } from '@shared/draws'
import { itemLink } from '@shared/folders'
import { Poster } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

export function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <View className={cn('size-8 shrink-0 items-center justify-center rounded-full bg-accent', className)}>
      <Text className="text-xs font-semibold uppercase">{name.slice(0, 2)}</Text>
    </View>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <View className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <View className="h-full rounded-full bg-primary" style={{ width: `${Math.round(value * 100)}%` }} />
    </View>
  )
}

export function ParticipantList({ participants, total }: { participants: Participant[]; total: number }) {
  return (
    <View className="gap-3">
      {participants.map((p) => (
        <View key={p.id} className="flex-row items-center gap-3">
          <Initials name={p.name} />
          <View className="flex-1 gap-1">
            <View className="flex-row justify-between">
              <Text className="text-sm font-medium">{p.name}</Text>
              <Text className="text-sm text-muted-foreground">
                {p.swiped} / {total}
              </Text>
            </View>
            <ProgressBar value={total ? p.swiped / total : 0} />
          </View>
        </View>
      ))}
    </View>
  )
}

export type VoteRow = { item: DrawItem; likes: number; votes: number; unanimous?: boolean; note?: string }

/** One ranked row; used directly as a FlashList cell for long result lists. */
export const VoteRowItem = memo(function VoteRowItem({ row, index }: { row: VoteRow; index: number }) {
  const { item, likes, votes, unanimous, note } = row
  const share = votes ? likes / votes : 0
  return (
    <Pressable
      onPress={() => {
        haptic.tap()
        router.push(itemLink(item) as Href)
      }}
      className="flex-row items-center gap-3 rounded-xl p-2 active:bg-accent"
    >
      <Text className="w-6 text-center text-sm font-semibold text-muted-foreground">{index + 1}</Text>
      <View className="aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-muted">
        <Poster src={item.poster} title={item.title} />
      </View>
      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row items-center gap-2">
          <Text className="shrink font-medium" numberOfLines={1}>
            {item.title}
          </Text>
          {unanimous && <Badge className="shrink-0">Alle wollen</Badge>}
        </View>
        <ProgressBar value={share} />
        <Text className="text-xs text-muted-foreground">
          {Math.round(share * 100)} % · {likes} von {votes} wollen{note ? ` · ${note}` : ''}
        </Text>
      </View>
    </Pressable>
  )
})

/** Short ranked list (statistics). Long lists use VoteRowItem in a FlashList. */
export function VoteList({ rows }: { rows: VoteRow[] }) {
  return (
    <View className="gap-2">
      {rows.map((row, index) => (
        <VoteRowItem key={row.item.key} row={row} index={index} />
      ))}
    </View>
  )
}

export function SectionTitle({ children }: { children: string }) {
  return <Text className="mb-3 text-lg font-semibold">{children}</Text>
}

/** Header of the Auslosung stack screens: back button, title, subtitle and optional actions. */
export function BackHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <View className="mb-4 flex-row items-start gap-3">
      <Button
        variant="ghost"
        size="icon-lg"
        icon={ArrowLeft}
        accessibilityLabel="Zurück"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/draws'))}
        className="-ml-3 shrink-0"
      />
      <View className="min-w-0 flex-1 pt-1">
        <Text className="text-2xl font-bold tracking-tight" numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {children}
    </View>
  )
}

/** Stack screens draw edge to edge and add the safe area themselves. */
export function useScreenPadding(extraBottom = 24) {
  const insets = useSafeAreaInsets()
  return { paddingTop: insets.top + 8, paddingBottom: insets.bottom + extraBottom, paddingHorizontal: 16 }
}
