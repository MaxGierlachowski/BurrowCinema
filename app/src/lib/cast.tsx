import { CastButton as GoogleCastButton, CastState, useCastState } from 'react-native-google-cast'
import { colors } from '@shared/theme'
import { isTV } from './tv'

/** Phones only: true while a Chromecast is connected. TVs never cast, so the native module is not touched there. */
export const useCasting: () => boolean = isTV ? () => false : () => useCastState() === CastState.CONNECTED

/** The native Cast icon; it opens the device list and shows the connection state. Nothing on TV. */
export function CastButton() {
  if (isTV) return null
  // The native button centers its icon, so the full 44 dp are tappable.
  return <GoogleCastButton accessibilityLabel="Auf Chromecast abspielen" style={{ width: 44, height: 44, tintColor: colors.foreground }} />
}

/**
 * Position handed between the local player and the cast screen of the same title, so switching continues where
 * the other one was. Both write it while playing; it only counts when fresh.
 */
let handoff: { itemId: string; seconds: number; at: number } | undefined

export function setHandoff(itemId: string, seconds: number) {
  handoff = { itemId, seconds, at: Date.now() }
}

export function takeHandoff(itemId: string) {
  const fresh = handoff && handoff.itemId === itemId && Date.now() - handoff.at < 15_000
  const seconds = fresh ? handoff?.seconds : undefined
  handoff = undefined
  return seconds
}
