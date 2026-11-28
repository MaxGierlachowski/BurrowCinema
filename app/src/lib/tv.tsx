/**
 * Everything TV specific goes through this file, nothing else imports TV APIs from react-native.
 * Implementation for react-native-tvos; with plain React Native only this file changes.
 */
import { useIsFocused } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactElement, type ReactNode, type Ref } from 'react'
import {
  BackHandler,
  Platform,
  Pressable,
  TVFocusGuideView,
  useTVEventHandler,
  View,
  type PressableProps,
  type StyleProp,
  type TVRemoteEvent,
  type ViewStyle,
} from 'react-native'
import { withUniwind } from 'uniwind'
import { cn } from '@/lib/utils'

/** One APK for phone and TV: decided at runtime from the Android UI mode (also true on Fire TV). */
export const isTV = Platform.isTV

export const TV_FOCUS_SCALE = 1.06

/** Instance of a View or Pressable, for refs and FocusGuide destinations (View is a function component in RN 0.88 types). */
export type ViewRef = ComponentRef<typeof View>

export type RemoteKey =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'playPause'
  | 'play'
  | 'pause'
  | 'rewind'
  | 'fastForward'
  | 'next'
  | 'previous'
  | 'menu'
  | 'info'

/** Android TV sends keys on release ('up'). A held key sends 'long' once while held and 'up' when released. */
export type RemoteEvent = { key: RemoteKey; action: 'down' | 'up' | 'long' }

const KEYS = new Set<string>([
  'up',
  'down',
  'left',
  'right',
  'select',
  'playPause',
  'play',
  'pause',
  'rewind',
  'fastForward',
  'next',
  'previous',
  'menu',
  'info',
])

function toRemoteEvent(evt: TVRemoteEvent): RemoteEvent | undefined {
  const isLong = evt.eventType.startsWith('long')
  const name = isLong ? evt.eventType[4].toLowerCase() + evt.eventType.slice(5) : evt.eventType
  if (!KEYS.has(name)) return undefined // focus, blur and keys we do not use
  const released = String(evt.eventKeyAction) === '1'
  return { key: name as RemoteKey, action: released ? 'up' : isLong ? 'long' : 'down' }
}

/** Remote control and media keys. The handler may change on every render. */
export function useRemoteKeys(handler: (e: RemoteEvent) => void, enabled = true) {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  const listener = useCallback(
    (evt: TVRemoteEvent) => {
      const event = enabled ? toRemoteEvent(evt) : undefined
      if (event) latest.current(event)
    },
    [enabled],
  )
  useTVEventHandler(listener)
}

/** Hardware back (and the TV remote's back key). Return true when the press was handled. */
export function useBackHandler(handler: () => boolean, enabled = true) {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    if (!enabled) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => latest.current())
    return () => subscription.remove()
  }, [enabled])
}

export type FocusableProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Gets the focus when the screen opens (hasTVPreferredFocus). Use once per pushed screen. */
  preferredFocus?: boolean
  className?: string
  /** Extra classes while focused (TV only). The default ring is a primary border. */
  focusedClassName?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode | ((state: { focused: boolean }) => ReactNode)
}

/** Pressable that shows focus on TV (primary ring, slight zoom) and behaves like a normal Pressable on phones. */
export function Focusable({
  preferredFocus,
  className,
  focusedClassName,
  style,
  children,
  onFocus,
  onBlur,
  ref,
  accessibilityRole = 'button',
  ...props
}: FocusableProps & { ref?: Ref<ViewRef> }): ReactElement {
  const [focused, setFocused] = useState(false)
  const showFocus = isTV && focused
  return (
    <Pressable
      ref={ref}
      accessibilityRole={accessibilityRole}
      hasTVPreferredFocus={isTV && preferredFocus}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
      className={cn(
        isTV ? 'border-2 border-transparent' : 'active:opacity-80',
        className,
        showFocus && cn('border-primary', focusedClassName),
      )}
      style={[style, showFocus && { transform: [{ scale: TV_FOCUS_SCALE }] }]}
      {...props}
    >
      {typeof children === 'function' ? children({ focused: showFocus }) : children}
    </Pressable>
  )
}

const FocusGuideView = withUniwind(TVFocusGuideView)

/** Steers focus between areas that are not aligned (TVFocusGuideView); a plain View on phones. */
export function FocusGuide({
  children,
  className,
  style,
  autoFocus,
  trapFocusLeft,
  trapFocusRight,
  trapFocusUp,
  trapFocusDown,
  destinations,
}: {
  children: ReactNode
  className?: string
  style?: StyleProp<ViewStyle>
  autoFocus?: boolean
  trapFocusLeft?: boolean
  trapFocusRight?: boolean
  trapFocusUp?: boolean
  trapFocusDown?: boolean
  destinations?: (ViewRef | null)[]
}): ReactElement {
  if (!isTV) {
    return (
      <View className={className} style={style}>
        {children}
      </View>
    )
  }
  return (
    <FocusGuideView
      className={className}
      style={style}
      autoFocus={autoFocus}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      trapFocusUp={trapFocusUp}
      trapFocusDown={trapFocusDown}
      destinations={destinations?.filter((d) => d !== null)}
    >
      {children}
    </FocusGuideView>
  )
}

const lastChosen = new Map<string, string>()

/**
 * Remembers the last chosen card per screen. When the screen is focused again (back navigation),
 * preferred(key) turns true for that card, which moves the TV focus back to it.
 */
export function useFocusMemory(screenKey: string) {
  const screenFocused = useIsFocused()
  const preferred = useCallback(
    (itemKey: string) => isTV && screenFocused && lastChosen.get(screenKey) === itemKey,
    [screenKey, screenFocused],
  )
  const remember = useCallback((itemKey: string) => void lastChosen.set(screenKey, itemKey), [screenKey])
  return { preferred, remember }
}
