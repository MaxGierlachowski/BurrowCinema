import { LinearGradient } from 'expo-linear-gradient'
import { Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { TrickplayTile } from '@shared/playback'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { clamp, formatTime } from '@/lib/player/time'
import { FocusGuide, isTV, useRemoteKeys, type RemoteKey } from '@/lib/tv'
import { Clock, PanelButtons, Title } from './ControlsParts'
import { SeekBar } from './SeekBar'
import { TrickplayPreview } from './TrickplayPreview'
import type { ControlsProps } from './types'

/** Remote controls: transport row from the middle outwards, panels to the right. Play/Pause gets the focus. */
export function TvControls(props: ControlsProps) {
  const { paused, position, duration, skipSeconds, onSeek } = props
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} className="justify-between px-14 py-10">
      <LinearGradient
        pointerEvents="none"
        colors={['#000000cc', '#00000000', '#00000000', '#000000e6']}
        locations={[0, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View className="flex-row items-start gap-6">
        <Title title={props.title} subtitle={props.subtitle} />
        <Clock position={position} duration={duration} rate={props.rate} />
      </View>

      <View className="gap-4">
        <FocusGuide trapFocusLeft trapFocusRight>
          <SeekBar
            position={position}
            duration={duration}
            chapters={props.chapters}
            pending={props.pending}
            trickplay={props.trickplay}
            onSeek={onSeek}
            onFocusChange={props.onSeekBarFocus}
          />
        </FocusGuide>
        <View className="flex-row items-center gap-2">
          {props.onPrevious && (
            <Button variant="ghost" size="icon" icon={SkipBack} accessibilityLabel="Vorherige Folge" onPress={props.onPrevious} />
          )}
          <Button
            variant="ghost"
            size="icon"
            icon={RotateCcw}
            accessibilityLabel={`${skipSeconds} Sekunden zurück`}
            onPress={() => onSeek(Math.max(0, position - skipSeconds))}
          />
          <Button
            size="icon"
            icon={paused ? Play : Pause}
            preferredFocus
            accessibilityLabel={paused ? 'Wiedergabe fortsetzen' : 'Wiedergabe pausieren'}
            onPress={props.onTogglePlay}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={RotateCw}
            accessibilityLabel={`${skipSeconds} Sekunden vor`}
            onPress={() => onSeek(Math.min(duration, position + skipSeconds))}
          />
          {props.onNext && (
            <Button variant="ghost" size="icon" icon={SkipForward} accessibilityLabel="Nächste Folge" onPress={props.onNext} />
          )}
          <View className="ml-auto">
            <PanelButtons panels={props.panels} onPanel={props.onPanel} />
          </View>
        </View>
      </View>
    </View>
  )
}

/** Small position display while seeking with hidden controls. */
export function SeekIndicator({ seconds, duration, tile }: { seconds: number; duration: number; tile?: TrickplayTile }) {
  return (
    <View pointerEvents="none" className="absolute inset-x-0 bottom-12 items-center gap-2">
      <TrickplayPreview tile={tile} seconds={seconds} width={256} />
      <View className="h-1 w-96 overflow-hidden rounded-full bg-white/25">
        <View className="h-1 bg-primary" style={{ width: `${duration > 0 ? clamp(seconds / duration, 0, 1) * 100 : 0}%` }} />
      </View>
      <Text className="text-sm text-foreground/70">{formatTime(duration)}</Text>
    </View>
  )
}

type KeyOptions = {
  controlsVisible: boolean
  panelOpen: boolean
  /** A button outside the controls holds the focus: the skip button (Select is its) or the Up Next card (also left and right). */
  overlay: 'none' | 'skip' | 'card'
  seekBarFocused: boolean
  position: number
  duration: number
  skipSeconds: number
  showControls: () => void
  interact: () => void
  togglePlay: () => void
  setPaused: (paused: boolean) => void
  seekTo: (seconds: number) => void
  /** A seek with hidden controls happened; show the small position display. */
  onSeekHint: () => void
  next?: () => void
  previous?: () => void
}

const SCRUB_TICK_MS = 250

/**
 * Remote and media keys. Media keys work everywhere (also on phones); D pad handling only on TV.
 * Keys arrive on release ('up'); a held left or right sends 'long' first, which scrubs until the release.
 * Returns the scrub position while a key is held.
 */
export function usePlayerKeys(o: KeyOptions) {
  const [pending, setPending] = useState<number>()
  const scrub = useRef<{ key: RemoteKey; target: number; timer: ReturnType<typeof setInterval> } | undefined>(undefined)
  const latest = useRef(o)
  useEffect(() => {
    latest.current = o
  })
  useEffect(() => () => clearInterval(scrub.current?.timer), [])

  const startScrub = (key: RemoteKey, direction: number) => {
    clearInterval(scrub.current?.timer)
    let steps = 0
    const state = {
      key,
      target: o.position,
      timer: setInterval(() => {
        const { duration, skipSeconds } = latest.current
        steps++
        // Speeds up the longer the key is held: 1x, 2x, ... up to 6x the skip step per tick.
        state.target = clamp(state.target + direction * skipSeconds * Math.min(6, 1 + Math.floor(steps / 8)), 0, duration)
        setPending(state.target)
      }, SCRUB_TICK_MS),
    }
    scrub.current = state
    setPending(state.target)
  }

  useRemoteKeys(({ key, action }) => {
    const horizontal = key === 'left' || key === 'right'
    if (action === 'down' || (action === 'long' && !horizontal)) return
    const seekBy = (delta: number) => o.seekTo(clamp(o.position + delta, 0, o.duration))

    switch (key) {
      case 'playPause':
        return o.togglePlay()
      case 'play':
        return o.setPaused(false)
      case 'pause':
        return o.setPaused(true)
      case 'rewind':
        return seekBy(-30)
      case 'fastForward':
        return seekBy(30)
      case 'next':
        return o.next?.()
      case 'previous':
        return o.previous?.()
    }
    if (!isTV) return

    if (scrub.current?.key === key) {
      clearInterval(scrub.current.timer)
      o.seekTo(scrub.current.target)
      scrub.current = undefined
      setPending(undefined)
      return o.controlsVisible ? o.interact() : o.onSeekHint()
    }
    if (o.panelOpen) return o.interact()

    const seekable = horizontal && (o.controlsVisible ? o.seekBarFocused : o.overlay !== 'card')
    if (seekable) {
      const direction = key === 'left' ? -1 : 1
      if (action === 'long') return startScrub(key, direction)
      seekBy(direction * o.skipSeconds)
      return o.controlsVisible ? o.interact() : o.onSeekHint()
    }
    if (o.controlsVisible) return o.interact()
    if (key === 'select' && o.overlay !== 'none') return
    if (key !== 'left' && key !== 'right') o.showControls()
  })

  return pending
}
