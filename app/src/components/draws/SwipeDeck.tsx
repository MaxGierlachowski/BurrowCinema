import { LinearGradient } from 'expo-linear-gradient'
import { Heart, Undo2, X } from 'lucide-react-native'
import { useImperativeHandle, useRef, type Ref } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { scheduleOnRN } from 'react-native-worklets'
import type { DrawItem } from '@shared/draws'
import { colors } from '@shared/theme'
import { Poster } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'

const THRESHOLD = 100
const FLING_VELOCITY = 900
const LEAVE_MS = 220
/** Height of everything else on the detail screen: header, progress, buttons, gaps. */
const RESERVED = 214

type Props = {
  items: DrawItem[]
  onSwipe: (item: DrawItem, like: boolean) => void
  onUndo: () => void
  canUndo: boolean
}

type CardHandle = { fly: (like: boolean) => void }

const clamp01 = (value: number) => {
  'worklet'
  return interpolate(value, [0, THRESHOLD], [0, 1], Extrapolation.CLAMP)
}

function CardFace({ item }: { item: DrawItem }) {
  const meta = [item.year, item.type === 'series' ? 'Serie' : 'Film', item.rating && `★ ${item.rating.toFixed(1)}`].filter(Boolean).join(' · ')
  return (
    <View className="size-full overflow-hidden rounded-2xl border border-white/10 bg-muted">
      <Poster src={item.poster} title={item.title} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 64 }}
      >
        <Text className="text-xl leading-tight font-bold text-white">{item.title}</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Text className="text-sm text-white/75">{meta}</Text>
          {item.source !== 'jellyfin' && (
            <Badge variant="secondary" className="bg-white/15">
              Nicht geladen
            </Badge>
          )}
        </View>
      </LinearGradient>
    </View>
  )
}

function Stamp({ label, color, side, opacity }: { label: string; color: string; side: 'left' | 'right'; opacity: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute top-6 rounded-lg border-2 px-3 py-1"
      style={[{ borderColor: color, [side]: 20, transform: [{ rotate: side === 'left' ? '-12deg' : '12deg' }] }, style]}
    >
      <Text className="text-lg font-bold tracking-wide" style={{ color }}>
        {label}
      </Text>
    </Animated.View>
  )
}

/**
 * The draggable top card. Position lives in shared values and the pan gesture runs as a worklet,
 * so dragging never touches the JS thread. Only the final decision is sent back with scheduleOnRN.
 */
function TopCard({ item, width, drag, onDecide, ref }: {
  item: DrawItem
  width: number
  drag: SharedValue<number>
  onDecide: (like: boolean) => void
  ref: Ref<CardHandle>
}) {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const pastThreshold = useSharedValue(false)
  const leaving = useSharedValue(false)

  useAnimatedReaction(
    () => x.value,
    (value) => drag.set(value),
  )

  const fly = (like: boolean) => {
    'worklet'
    if (leaving.value) return
    leaving.value = true
    scheduleOnRN(like ? haptic.success : haptic.tap)
    y.value = withTiming(y.value + 40, { duration: LEAVE_MS })
    x.value = withTiming((like ? 1 : -1) * width * 1.5, { duration: LEAVE_MS }, (finished) => {
      if (finished) scheduleOnRN(onDecide, like)
    })
  }

  useImperativeHandle(ref, () => ({ fly }))

  const pan = usePanGesture({
    // Horizontal drags move the card, vertical ones still scroll the screen.
    activeOffsetX: [-10, 10],
    onUpdate: (e) => {
      'worklet'
      if (leaving.value) return
      x.value = e.translationX
      y.value = e.translationY
      const past = Math.abs(e.translationX) > THRESHOLD
      if (past !== pastThreshold.value) {
        pastThreshold.value = past
        if (past) scheduleOnRN(haptic.select)
      }
    },
    onDeactivate: (e) => {
      'worklet'
      pastThreshold.value = false
      const flung = Math.abs(e.velocityX) > FLING_VELOCITY && Math.sign(e.velocityX) === Math.sign(e.translationX)
      if (Math.abs(e.translationX) > THRESHOLD || flung) {
        fly(e.translationX > 0)
      } else {
        x.value = withSpring(0)
        y.value = withSpring(0)
      }
    },
  })

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${x.value / 18}deg` }],
  }))
  const likeOpacity = useAnimatedReactionValue(x, 1)
  const nopeOpacity = useAnimatedReactionValue(x, -1)

  return (
    <GestureDetector gesture={pan}>
      <Animated.View className="absolute inset-0" style={cardStyle}>
        <CardFace item={item} />
        <Stamp label="WILL ICH" color={colors.like} side="left" opacity={likeOpacity} />
        <Stamp label="NÖ" color={colors.destructive} side="right" opacity={nopeOpacity} />
      </Animated.View>
    </GestureDetector>
  )
}

/** Stamp opacity follows the drag distance in one direction. */
function useAnimatedReactionValue(x: SharedValue<number>, direction: 1 | -1) {
  const opacity = useSharedValue(0)
  useAnimatedReaction(
    () => clamp01(x.value * direction),
    (value) => opacity.set(value),
  )
  return opacity
}

/** The card behind grows into place while the top card is dragged away. */
function NextCard({ item, drag }: { item: DrawItem; drag: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const progress = clamp01(Math.abs(drag.value))
    return { opacity: 0.6 + progress * 0.4, transform: [{ scale: 0.95 + progress * 0.05 }] }
  })
  return (
    <Animated.View className="absolute inset-0" style={style}>
      <CardFace item={item} />
    </Animated.View>
  )
}

/** Card size: whatever is left of the screen after header, progress and buttons, at a 2:3 poster ratio. */
function useCardSize() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const available = Math.max(288, height - insets.top - insets.bottom - RESERVED)
  const cardWidth = Math.min(width - 32, 384, (available * 2) / 3)
  return { width: cardWidth, height: (cardWidth * 3) / 2, screenWidth: width }
}

export function SwipeDeck({ items, onSwipe, onUndo, canUndo }: Props) {
  const size = useCardSize()
  const drag = useSharedValue(0)
  const card = useRef<CardHandle>(null)
  const [top, next] = items

  return (
    <View className="items-center gap-4">
      <View style={{ width: size.width, height: size.height }}>
        {next && <NextCard key={next.key} item={next} drag={drag} />}
        {top && <TopCard key={top.key} ref={card} item={top} width={size.screenWidth} drag={drag} onDecide={(like) => onSwipe(top, like)} />}
      </View>

      <View className="flex-row items-center gap-5">
        <Button
          size="icon-lg"
          variant="secondary"
          icon={X}
          haptics={false}
          accessibilityLabel="Gerade nicht"
          onPress={() => card.current?.fly(false)}
          className="[&>*]:text-destructive"
        />
        <Button size="icon" variant="ghost" icon={Undo2} accessibilityLabel="Rückgängig" disabled={!canUndo} onPress={onUndo} className="rounded-full" />
        <Button size="icon-lg" icon={Heart} haptics={false} accessibilityLabel="Will ich sehen" onPress={() => card.current?.fly(true)} />
      </View>
    </View>
  )
}
