import * as Haptics from 'expo-haptics'
import { isTV } from '@/lib/tv'

const ignore = () => undefined
/** TVs have no vibration motor, so every call is a no-op there. */
const run = (feedback: () => Promise<void>) => (isTV ? Promise.resolve() : feedback().catch(ignore))

/** Small wrappers so screens do not care about the haptics API details. Failures are ignored. */
export const haptic = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => run(() => Haptics.selectionAsync()),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
}
