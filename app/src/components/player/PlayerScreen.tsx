import { useQuery } from '@tanstack/react-query'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { router } from 'expo-router'
import * as ScreenOrientation from 'expo-screen-orientation'
import { Activity, AudioLines, Gauge, ListOrdered, Ratio, SlidersHorizontal, Subtitles, X } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@shared/hooks/useAuth'
import { getPlaybackItem, type BaseItem } from '@shared/jellyfin'
import {
  audioTrackPosition,
  BITRATE_OPTIONS,
  getPlaybackSettings,
  rememberTracks,
  SEGMENT_LABEL,
  secondsToTicks,
  streamLabel,
  ticksToSeconds,
  trickplayFor,
  trickplayTile,
  type MediaSegment,
  type PlaybackSettings,
  type ResolvedPlayback,
} from '@shared/playback'
import { colors } from '@shared/theme'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { clamp, formatTime, ignore } from '@/lib/player/time'
import { trackKey, usePlaybackSession, type TrackChange } from '@/lib/player/usePlaybackSession'
import { useProgressReporter } from '@/lib/player/useProgressReporter'
import { useSegments } from '@/lib/player/useSegments'
import { noteInteraction, useUpNext } from '@/lib/player/useUpNext'
import { qk } from '@/lib/queryKeys'
import { playHref, type PlayParams } from '@/lib/routes'
import { isTV, useBackHandler } from '@/lib/tv'
import { PhoneControls } from './PhoneControls'
import { SkipSegmentButton } from './SkipSegmentButton'
import { StatsOverlay } from './StatsOverlay'
import { StillWatching } from './StillWatching'
import { TrackPanel, type PanelOption } from './TrackPanel'
import { SeekIndicator, TvControls, usePlayerKeys } from './TvControls'
import type { PanelButton, PanelId } from './types'
import { UpNextCard, episodeCode } from './UpNextCard'
import { VideoSurface, type ResizeMode, type VideoSurfaceHandle } from './VideoSurface'

const HIDE_AFTER_MS = isTV ? 5000 : 4000
const SEEK_HINT_MS = 2500
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const RESIZE_MODES: { value: ResizeMode; label: string }[] = [
  { value: 'contain', label: 'Einpassen' },
  { value: 'cover', label: 'Zuschneiden' },
  { value: 'stretch', label: 'Strecken' },
]

const close = () => (router.canGoBack() ? router.back() : router.replace('/'))
const speedLabel = (rate: number) => (rate === 1 ? 'Normal' : `${String(rate).replace('.', ',')}×`)

// Players mounted at the same time (the next episode mounts before the old one is gone): only the last one unlocks.
let landscapeUsers = 0

/** Phones play in landscape and return to portrait afterwards; TVs are never locked. */
function useLandscape() {
  useEffect(() => {
    if (isTV) return
    landscapeUsers++
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(ignore)
    return () => {
      landscapeUsers--
      if (!landscapeUsers) ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(ignore)
    }
  }, [])
}

function PlayerMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-black px-8">
      <Text className="text-center text-xl font-semibold">{title}</Text>
      {detail && <Text className="text-center text-sm text-muted-foreground">{detail}</Text>}
      <Button variant="secondary" preferredFocus onPress={close}>
        Zurück
      </Button>
    </View>
  )
}

function Loading() {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 items-center justify-center bg-black">
      <ActivityIndicator size="large" color={colors.primary} />
      {!isTV && (
        <View className="absolute" style={{ top: insets.top + 8, left: insets.left + 16 }}>
          <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Player schließen" onPress={close} />
        </View>
      )}
    </View>
  )
}

/** Player route content: loads the item with streams, chapters and trickplay, then negotiates the stream. */
export function PlayerScreen({ id, params }: { id: string; params: PlayParams }) {
  const session = useSession()
  const item = useQuery({ queryKey: qk.playbackItem(id), queryFn: () => getPlaybackItem(session, id), staleTime: 0 })
  // The resume position must be fresh, so a cached item from before is not used to start.
  const fresh = item.isFetchedAfterMount ? item.data : undefined
  const [settings] = useState(getPlaybackSettings)
  const playback = usePlaybackSession(session, fresh, params, settings)
  useLandscape()

  const error = playback.error ?? (item.error ? item.error.message : undefined)
  if (error) return <PlayerMessage title="Wiedergabe fehlgeschlagen" detail={error} />
  if (!fresh || !playback.playback) return <Loading />
  return <Player item={fresh} settings={settings} session={playback} resolved={playback.playback} />
}

type PlayerProps = {
  item: BaseItem
  settings: PlaybackSettings
  session: ReturnType<typeof usePlaybackSession>
  resolved: ResolvedPlayback
}

function Player({ item, settings, session: negotiation, resolved }: PlayerProps) {
  const session = useSession()
  const surface = useRef<VideoSurfaceHandle>(null)
  const reporter = useProgressReporter(session, item, resolved)

  const [paused, setPaused] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [position, setPosition] = useState(() => ticksToSeconds(resolved.startTicks))
  const [duration, setDuration] = useState(() => ticksToSeconds(item.RunTimeTicks))
  const [rate, setRate] = useState(1)
  const [resizeMode, setResizeMode] = useState<ResizeMode>('contain')
  const [controls, setControls] = useState(true)
  const [panel, setPanel] = useState<PanelId>()
  const [stats, setStats] = useState(false)
  const [pipActive, setPipActive] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const [seekBarFocused, setSeekBarFocused] = useState(false)
  const [seekHint, setSeekHint] = useState(0)
  const [interaction, setInteraction] = useState(0)

  const interact = () => {
    noteInteraction()
    setInteraction((n) => n + 1)
  }
  const showControls = () => {
    setControls(true)
    interact()
  }
  const seekTo = (seconds: number) => {
    const target = clamp(seconds, 0, duration > 0 ? duration : seconds)
    surface.current?.seek(target)
    setPosition(target)
    reporter.seeked(target)
    noteInteraction()
  }
  const playEpisode = (episode: BaseItem) => {
    void reporter.stop()
    router.replace(playHref(episode.Id))
  }

  // Auto hide while playing; paused, an open panel or dragging keep the controls.
  useEffect(() => {
    if (!controls || paused || panel || scrubbing) return
    const timer = setTimeout(() => setControls(false), HIDE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [controls, paused, panel, scrubbing, interaction])

  useEffect(() => {
    if (!seekHint) return
    const timer = setTimeout(() => setSeekHint(0), SEEK_HINT_MS)
    return () => clearTimeout(timer)
  }, [seekHint])

  useEffect(() => reporter.setPaused(paused), [reporter, paused])

  // Keep the screen on only while playing, so the TV screensaver still starts when paused.
  // The tag is per item: the next episode activates its own before the old player releases.
  useEffect(() => {
    if (paused) return
    const tag = `player-${item.Id}`
    activateKeepAwakeAsync(tag).catch(ignore)
    return () => void deactivateKeepAwake(tag).catch(ignore)
  }, [paused, item.Id])

  // A new negotiation loads a new stream.
  useEffect(() => setBuffering(true), [resolved.playSessionId])

  // Leaving the app without picture in picture pauses (and reports the pause).
  const pipAllowed = !isTV && !paused
  const pipRef = useRef(pipAllowed)
  useEffect(() => {
    pipRef.current = pipAllowed
  })
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && !pipRef.current) setPaused(true)
    })
    return () => subscription.remove()
  }, [])

  function skipSegment(segment: MediaSegment) {
    if (segment.Type === 'Outro' && upNext.next) return upNext.open()
    seekTo(ticksToSeconds(segment.EndTicks))
  }
  const segment = useSegments(session, item.Id, secondsToTicks(position), settings.segmentActions, skipSegment)
  const upNext = useUpNext(session, item, { position, duration, segment, paused, settings, onPlay: playEpisode })
  const { next: nextEpisode, previous: previousEpisode } = upNext
  const playNext = nextEpisode && (() => playEpisode(nextEpisode))
  const playPrevious = previousEpisode && (() => playEpisode(previousEpisode))

  const changeTracks = (change: TrackChange) => {
    negotiation.changeTracks(change, secondsToTicks(position))
    const next = { ...resolved, ...change }
    const audio = next.audioStreams.find((m) => m.Index === next.audioStreamIndex)
    const subtitle = next.subtitleStreams.find((m) => m.Index === next.subtitleStreamIndex)
    rememberTracks(trackKey(item), { audioLanguage: audio?.Language, subtitleLanguage: next.subtitleStreamIndex < 0 ? null : subtitle?.Language })
  }

  const info = trickplayFor(item, resolved.mediaSource.Id)
  const trickplay = info ? (seconds: number) => trickplayTile(session, item.Id, resolved.mediaSource.Id, info, seconds * 1000) : undefined
  const chapters = item.Chapters ?? []
  const chapterIndex = chapters.reduce((found, c, i) => (ticksToSeconds(c.StartPositionTicks) <= position ? i : found), 0)

  const panels: PanelButton[] = [
    ...(resolved.audioStreams.length ? [{ id: 'audio' as const, label: 'Audio', icon: AudioLines }] : []),
    { id: 'subtitles', label: 'Untertitel', icon: Subtitles },
    { id: 'quality', label: 'Qualität', icon: SlidersHorizontal },
    { id: 'speed', label: 'Geschwindigkeit', icon: Gauge },
    { id: 'aspect', label: 'Bildformat', icon: Ratio },
    ...(chapters.length ? [{ id: 'chapters' as const, label: 'Kapitel', icon: ListOrdered }] : []),
    { id: 'stats', label: 'Statistiken', icon: Activity },
  ]

  const panelContent = (id: PanelId): { title: string; options: PanelOption[]; value: string; select: (value: string) => void } => {
    switch (id) {
      case 'audio':
        return {
          title: 'Audio',
          options: resolved.audioStreams.map((m) => ({ value: String(m.Index), label: streamLabel(m) })),
          value: String(resolved.audioStreamIndex),
          select: (v) => changeTracks({ audioStreamIndex: Number(v) }),
        }
      case 'subtitles':
        return {
          title: 'Untertitel',
          options: [
            { value: '-1', label: 'Aus' },
            ...resolved.subtitleStreams.map((m) => ({
              value: String(m.Index),
              label: streamLabel(m),
              hint: m.DeliveryMethod === 'Encode' ? 'wird eingebrannt' : undefined,
            })),
          ],
          value: String(resolved.subtitleStreamIndex),
          select: (v) => changeTracks({ subtitleStreamIndex: Number(v) }),
        }
      case 'quality':
        return {
          title: 'Qualität',
          options: BITRATE_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
          value: String(negotiation.maxBitrate),
          select: (v) => negotiation.changeQuality(Number(v), secondsToTicks(position)),
        }
      case 'speed':
        return {
          title: 'Geschwindigkeit',
          options: SPEEDS.map((s) => ({ value: String(s), label: speedLabel(s) })),
          value: String(rate),
          select: (v) => setRate(Number(v)),
        }
      case 'aspect':
        return { title: 'Bildformat', options: RESIZE_MODES, value: resizeMode, select: (v) => setResizeMode(v as ResizeMode) }
      case 'chapters':
        return {
          title: 'Kapitel',
          options: chapters.map((c, i) => ({
            value: String(i),
            label: c.Name ?? `Kapitel ${i + 1}`,
            hint: formatTime(ticksToSeconds(c.StartPositionTicks)),
          })),
          value: String(chapterIndex),
          select: (v) => seekTo(ticksToSeconds(chapters[Number(v)].StartPositionTicks)),
        }
    }
  }

  const openPanel = (id: PanelButton['id']) => {
    if (id === 'stats') return setStats((s) => !s)
    setPanel(id)
  }
  const closePanel = () => {
    setPanel(undefined)
    showControls()
  }

  const overlay = upNext.visible ? 'card' : segment ? 'skip' : 'none'
  const pending = usePlayerKeys({
    controlsVisible: controls && !panel,
    panelOpen: !!panel,
    overlay,
    seekBarFocused,
    position,
    duration,
    skipSeconds: settings.skipSeconds,
    showControls,
    interact,
    togglePlay: () => setPaused((p) => !p),
    setPaused,
    seekTo,
    onSeekHint: () => setSeekHint(Date.now()),
    next: playNext,
    previous: playPrevious,
  })

  // Back: first an open panel, on TV then the controls, then the player.
  useBackHandler(() => {
    if (panel) {
      closePanel()
      return true
    }
    if (isTV && (controls || seekHint)) {
      setControls(false)
      setSeekHint(0)
      return true
    }
    return false
  })

  const onError = (message: string) => {
    if (negotiation.fallback(secondsToTicks(position))) return
    void reporter.stop(true)
    negotiation.setError(message)
  }

  const isEpisode = item.Type === 'Episode'
  const title = isEpisode ? (item.SeriesName ?? item.Name) : item.Name
  const subtitle = isEpisode ? [episodeCode(item), item.Name].filter(Boolean).join(' · ') : undefined
  // A transcode only carries the chosen audio track; direct play switches inside the container.
  const audioPosition =
    resolved.playMethod !== 'Transcode' && resolved.audioStreamIndex !== undefined
      ? audioTrackPosition(resolved.mediaSource, resolved.audioStreamIndex)
      : undefined
  const externalTitle = resolved.externalSubtitles.find((t) => t.streamIndex === resolved.subtitleStreamIndex)?.title
  const controlsShown = controls && !panel && !pipActive && !upNext.stillWatching
  const Controls = isTV ? TvControls : PhoneControls
  const insets = useSafeAreaInsets()
  const segmentLabel = segment && segment.Type !== 'Unknown' ? SEGMENT_LABEL[segment.Type] : undefined
  const content = panel && panelContent(panel)

  return (
    <View className="flex-1 bg-black">
      <VideoSurface
        ref={surface}
        uri={resolved.url}
        headers={resolved.headers}
        isHls={resolved.playMethod === 'Transcode'}
        startSeconds={ticksToSeconds(resolved.startTicks)}
        textTracks={resolved.externalSubtitles}
        selectedSubtitleTitle={externalTitle}
        audioTrackPosition={audioPosition}
        paused={paused || upNext.stillWatching}
        rate={rate}
        resizeMode={resizeMode}
        subtitleSize={settings.subtitleSize}
        pip={pipAllowed}
        onLoad={(e) => {
          if (e.duration > 0) setDuration(e.duration)
          const start = ticksToSeconds(resolved.startTicks)
          // HLS may ignore startPosition (absolute or relative timeline), so check once and seek.
          if (Math.abs(e.currentTime - start) > 5) surface.current?.seek(start)
          setPosition(start)
          setBuffering(false)
          reporter.loaded(start)
        }}
        onProgress={(seconds) => {
          setPosition(seconds)
          reporter.progress(seconds)
        }}
        onBuffering={setBuffering}
        onEnd={() => (upNext.next ? upNext.ended() : close())}
        onError={onError}
        onPipChange={setPipActive}
      />

      {!isTV && (
        <Pressable
          accessibilityLabel="Bedienung einblenden"
          style={StyleSheet.absoluteFill}
          onPress={() => (panel ? closePanel() : controls ? setControls(false) : showControls())}
        />
      )}

      {buffering && !controlsShown && (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {stats && !pipActive && (
        <View className="absolute" style={{ top: insets.top + (isTV ? 120 : 72), left: insets.left + (isTV ? 56 : 16) }}>
          <StatsOverlay playback={resolved} />
        </View>
      )}

      {controlsShown && (
        <Controls
          title={title}
          subtitle={subtitle}
          paused={paused}
          position={position}
          duration={duration}
          rate={rate}
          skipSeconds={settings.skipSeconds}
          chapters={chapters.map((c) => ticksToSeconds(c.StartPositionTicks))}
          panels={panels}
          trickplay={trickplay}
          pending={pending}
          onTogglePlay={() => {
            setPaused((p) => !p)
            interact()
          }}
          onSeek={(seconds) => {
            seekTo(seconds)
            interact()
          }}
          onPanel={openPanel}
          onClose={close}
          onScrub={setScrubbing}
          onPip={() => surface.current?.enterPip()}
          onPrevious={playPrevious}
          onNext={playNext}
          onSeekBarFocus={setSeekBarFocused}
        />
      )}

      {isTV && !controlsShown && (pending !== undefined || seekHint > 0) && (
        <SeekIndicator seconds={pending ?? position} duration={duration} tile={pending !== undefined ? trickplay?.(pending) : undefined} />
      )}

      {!pipActive && !panel && !upNext.stillWatching && (
        <View
          pointerEvents="box-none"
          className="absolute items-end gap-3"
          style={{ right: insets.right + (isTV ? 56 : 24), bottom: insets.bottom + (controlsShown ? (isTV ? 180 : 120) : isTV ? 56 : 32) }}
        >
          {segmentLabel && !upNext.visible && <SkipSegmentButton label={segmentLabel} onPress={() => segment && skipSegment(segment)} />}
          {upNext.visible && nextEpisode && (
            <UpNextCard
              episode={nextEpisode}
              secondsLeft={upNext.autoPlay ? upNext.secondsLeft : undefined}
              onPlay={upNext.playNow}
              onCancel={upNext.cancel}
            />
          )}
        </View>
      )}

      {content && (
        <TrackPanel
          title={content.title}
          options={content.options}
          value={content.value}
          onSelect={(value) => {
            content.select(value)
            closePanel()
          }}
          onClose={closePanel}
        />
      )}

      {upNext.stillWatching && <StillWatching onContinue={upNext.keepWatching} onExit={close} />}
    </View>
  )
}
