import { useEffect } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  const opacity = useSharedValue(0.5)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true)
  }, [opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={style} className={cn('rounded-lg bg-muted', className)} />
}
