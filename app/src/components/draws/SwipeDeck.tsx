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
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets'
import type { DrawItem } from '@shared/draws'
import { colors } from '@shared/theme'
import { Poster } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'

const THRESHOLD = 100
const FLING_VELOCITY = 900
const LEAVE_MS = 220
/** Height of everything else on the detail screen: header, progress, buttons and gaps. */
const RESERVED = 214

type Props = {
  items: DrawItem[]
  onSwipe: (item: DrawItem, like: boolean) => void
  onUndo: () => void
  canUndo: boolean
}

type CardHandle = { fly: (like: boolean) => void }

/** 0 at rest, 1 at the swipe threshold. */
const progress = (distance: number) => {
  'worklet'
  return interpolate(distance, [0, THRESHOLD], [0, 1], Extrapolation.CLAMP)
}

// Plain JS functions, called from the UI thread with scheduleOnRN.
const feedback = (like: boolean) => (like ? haptic.success() : haptic.tap())
const crossed = () => haptic.select()

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

/** "WILL ICH" or "NÖ"; fades in with the drag distance in its direction. */
function Stamp({ label, color, side, x }: { label: string; color: string; side: 'left' | 'right'; x: SharedValue<number> }) {
  const direction = side === 'left' ? 1 : -1
  const style = useAnimatedStyle(() => ({ opacity: progress(x.get() * direction) }))
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

type DeckCardProps = {
  item: DrawItem
  isTop: boolean
  screenWidth: number
  drag: SharedValue<number>
  onDecide: (like: boolean) => void
  ref?: Ref<CardHandle>
}

/**
 * One card of the deck. The same instance moves from second place to the top, so its poster stays loaded.
 * On top, its position lives in shared values and the pan callbacks are worklets: dragging runs entirely
 * on the UI thread, only the decision goes back to JS with scheduleOnRN. Behind, it grows with the drag.
 */
function DeckCard({ item, isTop, screenWidth, drag, onDecide, ref }: DeckCardProps) {
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const pastThreshold = useSharedValue(false)
  const leaving = useSharedValue(false)

  useAnimatedReaction(
    () => x.get(),
    (value) => {
      if (isTop) drag.set(value)
    },
    [isTop],
  )

  const fly = (like: boolean) => {
    'worklet'
    if (leaving.get()) return
    leaving.set(true)
    scheduleOnRN(feedback, like)
    y.set(withTiming(y.get() + 40, { duration: LEAVE_MS }))
    x.set(
      withTiming((like ? 1 : -1) * screenWidth * 1.5, { duration: LEAVE_MS }, (finished) => {
        if (finished) scheduleOnRN(onDecide, like)
      }),
    )
  }

  // The buttons below the deck trigger the same animation.
  useImperativeHandle(ref, () => ({ fly: (like: boolean) => scheduleOnUI(fly, like) }))

  const pan = usePanGesture({
    enabled: isTop,
    // Horizontal drags move the card, vertical ones still scroll the screen.
    activeOffsetX: [-10, 10],
    onUpdate: (e) => {
      'worklet'
      if (leaving.get()) return
      x.set(e.translationX)
      y.set(e.translationY)
      const past = Math.abs(e.translationX) > THRESHOLD
      if (past !== pastThreshold.get()) {
        pastThreshold.set(past)
        if (past) scheduleOnRN(crossed)
      }
    },
    onDeactivate: (e) => {
      'worklet'
      pastThreshold.set(false)
      if (leaving.get()) return
      const flung = Math.abs(e.velocityX) > FLING_VELOCITY && Math.sign(e.velocityX) === Math.sign(e.translationX)
      if (Math.abs(e.translationX) > THRESHOLD || flung) {
        fly(e.translationX > 0)
      } else {
        x.set(withSpring(0))
        y.set(withSpring(0))
      }
    },
  })

  const style = useAnimatedStyle(() => {
    if (isTop) {
      return { zIndex: 2, opacity: 1, transform: [{ translateX: x.get() }, { translateY: y.get() }, { rotate: `${x.get() / 18}deg` }, { scale: 1 }] }
    }
    const p = progress(Math.abs(drag.get()))
    return { zIndex: 1, opacity: 0.6 + p * 0.4, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 0.95 + p * 0.05 }] }
  }, [isTop])

  return (
    <GestureDetector gesture={pan}>
      <Animated.View className="absolute inset-0" style={style}>
        <CardFace item={item} />
        {isTop && <Stamp label="WILL ICH" color={colors.like} side="left" x={x} />}
        {isTop && <Stamp label="NÖ" color={colors.destructive} side="right" x={x} />}
      </Animated.View>
    </GestureDetector>
  )
}

/** Whatever is left of the screen after header, progress and buttons, at the 2:3 poster ratio. */
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
        {[next, top].map(
          (item) =>
            item && (
              <DeckCard
                key={item.key}
                ref={item === top ? card : undefined}
                item={item}
                isTop={item === top}
                screenWidth={size.screenWidth}
                drag={drag}
                onDecide={(like) => onSwipe(item, like)}
              />
            ),
        )}
      </View>

      <View className="flex-row items-center gap-5">
        <Button size="icon-lg" variant="secondary" haptics={false} accessibilityLabel="Gerade nicht" onPress={() => card.current?.fly(false)}>
          <Icon as={X} color="destructive" size={26} />
        </Button>
        <Button size="icon" variant="ghost" icon={Undo2} accessibilityLabel="Rückgängig" disabled={!canUndo} onPress={onUndo} className="rounded-full" />
        <Button size="icon-lg" haptics={false} accessibilityLabel="Will ich sehen" onPress={() => card.current?.fly(true)}>
          <Icon as={Heart} color="primaryForeground" fill={colors.primaryForeground} size={26} />
        </Button>
      </View>
    </View>
  )
}
