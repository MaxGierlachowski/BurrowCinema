import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeviceCaps } from '@shared/deviceProfile'
import { JellyfinError, type BaseItem, type Session } from '@shared/jellyfin'
import {
  applyTrackChoice,
  needsRenegotiation,
  PlaybackError,
  recallTracks,
  startPlayback,
  startTicksFor,
  stopTranscode,
  type PlaybackRequest,
  type PlaybackSettings,
  secondsToTicks,
  type ResolvedPlayback,
} from '@shared/playback'
import { takeHandoff } from '@/lib/cast'
import { getDeviceCaps } from '@/lib/deviceCaps'
import type { PlayParams } from '@/lib/routes'
import { ignore } from './time'

/** Remembered tracks are shared by all episodes of a series. */
export const trackKey = (item: BaseItem) => item.SeriesId ?? item.Id

export type TrackChange = { audioStreamIndex?: number; subtitleStreamIndex?: number }

// Our own errors are German; anything else (fetch's "Network request failed", broken JSON) is a connection problem.
export const errorText = (error: unknown) =>
  error instanceof PlaybackError || error instanceof JellyfinError ? error.message : 'Verbindung zu Jellyfin fehlgeschlagen'

/** Audio codecs the device profile direct plays (shared/deviceProfile.ts), AC 3 and E AC 3 only with caps.ac3. */
const DIRECT_AUDIO = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac', 'pcm_s16le', 'pcm_s24le'])
const DOLBY_AUDIO = new Set(['ac3', 'eac3'])

/**
 * Jellyfin only checks the selected audio track for direct play. Switching inside the player to a track the device
 * cannot decode (DTS, TrueHD, an external file) would play silently, so that switch goes to the server instead.
 */
function audioNeedsServer(current: ResolvedPlayback, caps: DeviceCaps, streamIndex?: number) {
  if (current.playMethod === 'Transcode' || streamIndex === undefined || streamIndex === current.audioStreamIndex) return false
  const stream = current.audioStreams.find((m) => m.Index === streamIndex)
  const codec = stream?.Codec?.toLowerCase()
  if (!stream) return false
  if (stream.IsExternal) return true
  return !!codec && !DIRECT_AUDIO.has(codec) && !(caps.ac3 && DOLBY_AUDIO.has(codec))
}

/**
 * Negotiates the stream (PlaybackInfo) and renegotiates at the current position when a track or the quality
 * needs it. A failing direct play gets exactly one retry as transcode before the error is shown.
 */
export function usePlaybackSession(session: Session, item: BaseItem | undefined, params: PlayParams, settings: PlaybackSettings) {
  const [playback, setPlayback] = useState<ResolvedPlayback>()
  const [error, setError] = useState<string>()
  const current = useRef<ResolvedPlayback | undefined>(undefined)
  const lastRequest = useRef<PlaybackRequest | undefined>(undefined)
  const fellBack = useRef(false)
  // Only the latest renegotiation may replace the stream (two quick changes, or leaving the player meanwhile).
  const generation = useRef(0)
  const latest = useRef({ item, params, settings })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    latest.current = { item, params, settings }
    current.current = playback
  })

  const itemId = item?.Id
  useEffect(() => {
    const { item, params, settings } = latest.current
    if (!item) return
    let cancelled = false
    ;(async () => {
      const source = item.MediaSources?.find((m) => m.Id === params.mediaSourceId) ?? item.MediaSources?.[0]
      const remembered = source ? applyTrackChoice(source, recallTracks(trackKey(item))) : {}
      const handed = params.start === 'beginning' ? undefined : takeHandoff(item.Id)
      const request: PlaybackRequest = {
        itemId: item.Id,
        mediaSourceId: source?.Id,
        // Coming back from the Chromecast continues where it was.
        startTicks: handed !== undefined ? secondsToTicks(handed) : startTicksFor(item, params.start ?? 'resume', settings.resumeRewindSeconds),
        audioStreamIndex: params.audio ?? remembered.audioStreamIndex,
        subtitleStreamIndex: params.sub ?? remembered.subtitleStreamIndex,
        maxBitrate: settings.maxBitrate,
        caps: await getDeviceCaps(settings.allowAc3OnPhone),
      }
      const resolved = await startPlayback(session, request)
      if (cancelled) return
      lastRequest.current = request
      setPlayback(resolved)
    })().catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [session, itemId, attempt])

  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )

  const renegotiate = useCallback(
    async (change: Partial<PlaybackRequest>, positionTicks: number) => {
      const old = current.current
      const base = lastRequest.current
      if (!old || !base) return
      const run = ++generation.current
      const request: PlaybackRequest = {
        ...base,
        mediaSourceId: old.mediaSource.Id,
        audioStreamIndex: old.audioStreamIndex,
        subtitleStreamIndex: old.subtitleStreamIndex,
        ...change,
        startTicks: positionTicks,
      }
      try {
        const resolved = await startPlayback(session, request)
        if (run !== generation.current) return
        if (old.playMethod === 'Transcode') stopTranscode(session, old.playSessionId).catch(ignore)
        lastRequest.current = request
        current.current = resolved
        setPlayback(resolved)
      } catch (e) {
        if (run === generation.current) setError(errorText(e))
      }
    },
    [session],
  )

  /** Audio or subtitle change: inside the player when possible, otherwise a new negotiation. */
  const changeTracks = useCallback(
    (change: TrackChange, positionTicks: number) => {
      const old = current.current
      if (!old) return
      const caps = lastRequest.current?.caps
      const server = needsRenegotiation(old, change) || (!!caps && audioNeedsServer(old, caps, change.audioStreamIndex))
      if (server) return void renegotiate(change, positionTicks)
      const next = { ...old, ...change }
      current.current = next
      setPlayback(next)
    },
    [renegotiate],
  )

  const changeQuality = useCallback(
    (maxBitrate: number, positionTicks: number) => {
      if (maxBitrate !== lastRequest.current?.maxBitrate) void renegotiate({ maxBitrate }, positionTicks)
    },
    [renegotiate],
  )

  /** Called on a player error. Returns true when a transcode retry was started. */
  const fallback = useCallback(
    (positionTicks: number) => {
      if (fellBack.current || current.current?.playMethod !== 'DirectPlay') return false
      fellBack.current = true
      void renegotiate({ enableDirectPlay: false }, positionTicks)
      return true
    },
    [renegotiate],
  )

  const maxBitrate = lastRequest.current?.maxBitrate ?? settings.maxBitrate
  const retry = useCallback(() => {
    setError(undefined)
    fellBack.current = false
    setAttempt((n) => n + 1)
  }, [])

  return { playback, error, setError, changeTracks, changeQuality, fallback, retry, maxBitrate }
}
