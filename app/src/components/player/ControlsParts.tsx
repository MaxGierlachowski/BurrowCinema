import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { formatClock } from '@/lib/player/time'
import { isTV } from '@/lib/tv'
import { cn } from '@/lib/utils'
import type { ControlsProps } from './types'

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Current time and "Endet um", which takes the playback speed into account. */
export function Clock({ position, duration, rate }: Pick<ControlsProps, 'position' | 'duration' | 'rate'>) {
  const now = useNow()
  const remaining = duration > 0 ? Math.max(0, duration - position) / (rate || 1) : 0
  return (
    <View pointerEvents="none" className="items-end">
      <Text className={cn('font-semibold text-foreground', isTV ? 'text-xl' : 'text-base')}>{formatClock(now)}</Text>
      {remaining > 0 && (
        <Text className={cn('text-foreground/70', isTV ? 'text-base' : 'text-xs')}>
          Endet um {formatClock(new Date(now.getTime() + remaining * 1000))}
        </Text>
      )}
    </View>
  )
}

export function Title({ title, subtitle }: Pick<ControlsProps, 'title' | 'subtitle'>) {
  return (
    <View pointerEvents="none" className="min-w-0 flex-1">
      <Text className={cn('font-bold text-foreground', isTV ? 'text-3xl' : 'text-lg')} numberOfLines={1}>
        {title}
      </Text>
      {subtitle && (
        <Text className={cn('text-foreground/70', isTV ? 'text-lg' : 'text-sm')} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  )
}

/** Forward skip; while the duration is still unknown (0) it is not capped, or it would jump to the start. */
export const skipTarget = (position: number, seconds: number, duration: number) =>
  duration > 0 ? Math.min(duration, position + seconds) : position + seconds

/** Audio, Untertitel, Qualität and the other panels. */
export function PanelButtons({ panels, onPanel }: Pick<ControlsProps, 'panels' | 'onPanel'>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }} className="grow-0">
      {panels.map((panel) => (
        <Button
          key={panel.id}
          variant="ghost"
          size={isTV ? 'sm' : 'default'}
          icon={panel.icon}
          accessibilityLabel={panel.label}
          onPress={() => onPanel(panel.id)}
        >
          {panel.label}
        </Button>
      ))}
    </ScrollView>
  )
}
