import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Cast, Pause, Play, RotateCcw, RotateCw, X } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import {
  MediaPlayerIdleReason,
  MediaPlayerState,
  MediaStreamType,
  useCastDevice,
  useMediaStatus,
  useRemoteMediaClient,
  useStreamPosition,
  type MediaInfo,
} from 'react-native-google-cast'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DEFAULT_CAPS } from '@shared/deviceProfile'
import { useSession } from '@shared/hooks/useAuth'
import { backdropUrl, getPlaybackItem, seriesPosterUrl, type BaseItem, type Session } from '@shared/jellyfin'
import {
  applyTrackChoice,
  getPlaybackSettings,
  recallTracks,
  secondsToTicks,
  startPlayback,
  startTicksFor,
  ticksToSeconds,
  type ResolvedPlayback,
} from '@shared/playback'
import { colors } from '@shared/theme'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { CastButton, setHandoff, takeHandoff } from '@/lib/cast'
import { ignore } from '@/lib/player/time'
import { errorText, trackKey } from '@/lib/player/usePlaybackSession'
import { useProgressReporter } from '@/lib/player/useProgressReporter'
import { qk } from '@/lib/queryKeys'
import type { PlayParams } from '@/lib/routes'
import { skipTarget } from './ControlsParts'
import { episodeCode } from './UpNextCard'
import { SeekBar } from './SeekBar'

const close = () => (router.canGoBack() ? router.back() : router.replace('/'))

/** What the Default Media Receiver gets: the Jellyfin stream URL (token in the query), metadata and WebVTT tracks. */
function castMedia(s: Session, item: BaseItem, playback: ResolvedPlayback): MediaInfo {
  const images = [seriesPosterUrl(s, item, 600)].filter((url) => url !== undefined).map((url) => ({ url }))
  const isHls = playback.playMethod === 'Transcode'
  return {
    contentId: playback.url,
    contentUrl: playback.url,
    contentType: isHls ? 'application/x-mpegURL' : playback.mediaSource.Container === 'webm' ? 'video/webm' : 'video/mp4',
    streamType: MediaStreamType.BUFFERED,
    streamDuration: ticksToSeconds(item.RunTimeTicks) || undefined,
    metadata:
      item.Type === 'Episode'
        ? {
            type: 'tvShow',
            seriesTitle: item.SeriesName,
            title: item.Name,
            seasonNumber: item.ParentIndexNumber,
            episodeNumber: item.IndexNumber,
            images,
          }
        : { type: 'movie', title: item.Name, images },
    mediaTracks: playback.externalSubtitles
      .filter((t) => t.mimeType === 'text/vtt')
      .map((t) => ({ id: t.streamIndex + 1, type: 'text', subtype: 'subtitles', contentId: t.uri, contentType: 'text/vtt', name: t.label, language: t.language })),
  }
}

/** Player route content while a Chromecast is connected: the phone becomes the remote. */
export function CastScreen({ id, params }: { id: string; params: PlayParams }) {
  const session = useSession()
  const item = useQuery({ queryKey: qk.playbackItem(id), queryFn: () => getPlaybackItem(session, id), staleTime: 0 })
  const fresh = item.isFetchedAfterMount ? item.data : undefined
  if (item.error) return <CastMessage text={item.error.message} />
  if (!fresh) return <CastMessage loading />
  return <CastPlayer item={fresh} params={params} />
}

function CastMessage({ text, loading }: { text?: string; loading?: boolean }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
      {loading ? <ActivityIndicator color={colors.primary} /> : <Text className="text-center text-muted-foreground">{text}</Text>}
      {!loading && (
        <Button variant="secondary" onPress={close}>
          Zurück
        </Button>
      )}
    </View>
  )
}

function CastPlayer({ item, params }: { item: BaseItem; params: PlayParams }) {
  const session = useSession()
  const insets = useSafeAreaInsets()
  const client = useRemoteMediaClient()
  const device = useCastDevice()
  const status = useMediaStatus()
  const streamPosition = useStreamPosition(1)
  const [playback, setPlayback] = useState<ResolvedPlayback>()
  const [error, setError] = useState<string>()
  const [start, setStart] = useState(0)
  const reporter = useProgressReporter(session, item, playback)
  const loaded = useRef(false)
  const [settings] = useState(getPlaybackSettings)

  // Negotiates with the Chromecast profile and hands the stream to the receiver, at the local player's position.
  useEffect(() => {
    if (!client || loaded.current) return
    loaded.current = true
    ;(async () => {
      const source = item.MediaSources?.find((m) => m.Id === params.mediaSourceId) ?? item.MediaSources?.[0]
      const remembered = source ? applyTrackChoice(source, recallTracks(trackKey(item))) : {}
      const handed = params.start === 'beginning' ? undefined : takeHandoff(item.Id)
      const startTicks = handed !== undefined ? secondsToTicks(handed) : startTicksFor(item, params.start ?? 'resume', settings.resumeRewindSeconds)
      const resolved = await startPlayback(session, {
        itemId: item.Id,
        mediaSourceId: source?.Id,
        startTicks,
        audioStreamIndex: params.audio ?? remembered.audioStreamIndex,
        subtitleStreamIndex: params.sub ?? remembered.subtitleStreamIndex,
        maxBitrate: settings.maxBitrate,
        caps: DEFAULT_CAPS,
        target: 'cast',
      })
      setStart(ticksToSeconds(startTicks))
      setPlayback(resolved)
      await client.loadMedia({ mediaInfo: castMedia(session, item, resolved), startTime: ticksToSeconds(startTicks), autoplay: true })
      const subtitle = resolved.externalSubtitles.find((t) => t.streamIndex === resolved.subtitleStreamIndex && t.mimeType === 'text/vtt')
      if (subtitle) await client.setActiveTrackIds([subtitle.streamIndex + 1])
    })().catch((e) => setError(errorText(e)))
  }, [client, item, params, session, settings.maxBitrate, settings.resumeRewindSeconds])

  // Closing the cast screen ends the playback on the TV; the Chromecast stays connected for the next title.
  const clientRef = useRef(client)
  clientRef.current = client
  useEffect(() => () => void clientRef.current?.stop().catch(ignore), [])

  const state = status?.playerState
  const media = status?.mediaInfo
  const ours = !!playback && (media?.contentUrl ?? media?.contentId) === playback.url
  const paused = state === MediaPlayerState.PAUSED
  const position = ours ? (streamPosition ?? start) : start
  const duration = ticksToSeconds(item.RunTimeTicks)

  // Jellyfin hears about the cast playback from the phone, exactly like the local player reports.
  useEffect(() => {
    if (!ours) return
    if (state === MediaPlayerState.PLAYING) reporter.loaded(position)
    reporter.setPaused(paused)
  }, [ours, state, paused, position, reporter])
  useEffect(() => {
    if (!ours || streamPosition === null) return
    reporter.progress(streamPosition)
    setHandoff(item.Id, streamPosition)
  }, [ours, streamPosition, reporter, item.Id])
  useEffect(() => {
    if (ours && state === MediaPlayerState.IDLE && status?.idleReason === MediaPlayerIdleReason.FINISHED) close()
  }, [ours, state, status?.idleReason])

  const seek = (seconds: number) => client?.seek({ position: Math.max(0, seconds) }).catch(ignore)
  const toggle = () => (paused ? client?.play() : client?.pause())?.catch(ignore)
  const busy = !error && (!ours || state === MediaPlayerState.BUFFERING || state === MediaPlayerState.LOADING)
  const backdrop = backdropUrl(session, item, 1200)
  const poster = seriesPosterUrl(session, item, 600)

  return (
    <View className="flex-1 bg-background">
      {backdrop && <Image source={backdrop} contentFit="cover" blurRadius={24} style={{ position: 'absolute', inset: 0, opacity: 0.35 }} />}
      <View className="flex-row items-center justify-between px-2" style={{ paddingTop: insets.top + 4 }}>
        <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Player schließen" onPress={close} />
        <CastButton />
      </View>

      <View className="flex-1 items-center justify-center gap-5 px-8">
        {poster && <Image source={poster} contentFit="cover" style={{ width: 180, aspectRatio: 2 / 3, borderRadius: 12 }} />}
        <View className="items-center gap-1">
          <Text className="text-center text-xl font-semibold" numberOfLines={2}>
            {item.Type === 'Episode' ? (item.SeriesName ?? item.Name) : item.Name}
          </Text>
          {item.Type === 'Episode' && (
            <Text className="text-center text-muted-foreground" numberOfLines={1}>
              {[episodeCode(item), item.Name].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Icon as={Cast} color="primary" size={16} />
          <Text className="text-sm text-muted-foreground">
            {error ?? (device ? `Wird auf ${device.friendlyName} abgespielt` : 'Verbinde mit Chromecast')}
          </Text>
        </View>
      </View>

      <View className="gap-4 px-6" style={{ paddingBottom: insets.bottom + 24 }}>
        <SeekBar position={position} duration={duration} chapters={[]} step={settings.skipSeconds} onSeek={seek} />
        <View className="flex-row items-center justify-center gap-8">
          <Button
            variant="ghost"
            size="icon-lg"
            icon={RotateCcw}
            accessibilityLabel={`${settings.skipSeconds} Sekunden zurück`}
            onPress={() => seek(position - settings.skipSeconds)}
          />
          <Button
            size="icon-lg"
            icon={busy ? undefined : paused ? Play : Pause}
            accessibilityLabel={paused ? 'Wiedergabe fortsetzen' : 'Wiedergabe pausieren'}
            onPress={toggle}
            disabled={!ours}
            className="size-16"
          >
            {busy && <ActivityIndicator color={colors.primaryForeground} />}
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            icon={RotateCw}
            accessibilityLabel={`${settings.skipSeconds} Sekunden vor`}
            onPress={() => seek(skipTarget(position, settings.skipSeconds, duration))}
          />
        </View>
      </View>
    </View>
  )
}
