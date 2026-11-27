import { useState } from 'react'
import { View, type GestureResponderEvent } from 'react-native'
import type { TrickplayTile } from '@shared/playback'
import { Text } from '@/components/ui/text'
import { clamp, formatTime } from '@/lib/player/time'
import { Focusable, isTV } from '@/lib/tv'
import { cn } from '@/lib/utils'
import { TrickplayPreview } from './TrickplayPreview'

type Props = {
  position: number
  duration: number
  /** Chapter starts in seconds, drawn as marks. */
  chapters: number[]
  /** TV: position while scrubbing with the remote. */
  pending?: number
  trickplay?: (seconds: number) => TrickplayTile | undefined
  onSeek: (seconds: number) => void
  /** Phone: dragging started or ended (keeps the controls open). */
  onScrub?: (active: boolean) => void
  /** TV: the bar got or lost the focus; left and right then seek. */
  onFocusChange?: (focused: boolean) => void
}

const PREVIEW_WIDTH = 192

/**
 * Seek bar. On phones it is dragged with the responder system (no gesture package needed); the children ignore
 * touches so locationX is always relative to the bar. On TV it is focusable and the remote moves the position.
 */
export function SeekBar({ position, duration, chapters, pending, trickplay, onSeek, onScrub, onFocusChange }: Props) {
  const [width, setWidth] = useState(0)
  const [drag, setDrag] = useState<number>()
  const preview = drag ?? pending
  const shown = preview ?? position
  const ratio = duration > 0 ? clamp(shown / duration, 0, 1) : 0
  const at = (e: GestureResponderEvent) => (width > 0 ? clamp(e.nativeEvent.locationX / width, 0, 1) * duration : 0)

  const track = (
    <View pointerEvents="none" className="h-1.5 justify-center rounded-full bg-white/25">
      <View className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
      {duration > 0 &&
        chapters.map((start) => (
          <View key={start} className="absolute h-1.5 w-0.5 bg-black/60" style={{ left: `${(start / duration) * 100}%` }} />
        ))}
      <View className="absolute size-4 rounded-full bg-primary" style={{ left: ratio * width - 8, top: -5 }} />
    </View>
  )

  const a11y = {
    accessibilityLabel: 'Position',
    accessibilityRole: 'adjustable' as const,
    accessibilityValue: { min: 0, max: Math.round(duration), now: Math.round(shown), text: formatTime(shown) },
  }

  return (
    <View className="gap-1">
      {preview !== undefined && width > 0 && (
        <View pointerEvents="none" className="absolute bottom-14" style={{ left: clamp(ratio * width - PREVIEW_WIDTH / 2, 0, Math.max(0, width - PREVIEW_WIDTH)) }}>
          <View style={{ width: PREVIEW_WIDTH }}>
            <TrickplayPreview tile={trickplay?.(preview)} seconds={preview} width={PREVIEW_WIDTH} />
          </View>
        </View>
      )}
      {isTV ? (
        <Focusable
          {...a11y}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width - 4)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          className="h-8 justify-center rounded-lg"
          focusedClassName="bg-white/10"
        >
          {track}
        </Focusable>
      ) : (
        <View
          {...a11y}
          accessible
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => {
            onScrub?.(true)
            setDrag(at(e))
          }}
          onResponderMove={(e) => setDrag(at(e))}
          onResponderRelease={(e) => {
            onSeek(at(e))
            setDrag(undefined)
            onScrub?.(false)
          }}
          onResponderTerminate={() => {
            setDrag(undefined)
            onScrub?.(false)
          }}
          className="h-10 justify-center"
        >
          {track}
        </View>
      )}
      <View pointerEvents="none" className="flex-row justify-between">
        <Text className={cn('text-sm text-white tabular-nums', isTV && 'text-base')}>{formatTime(shown)}</Text>
        <Text className={cn('text-sm text-white/70 tabular-nums', isTV && 'text-base')}>-{formatTime(Math.max(0, duration - shown))}</Text>
      </View>
    </View>
  )
}
