import { useCallback, useEffect, useRef, useState } from 'react'
import type { BaseItem, Session } from '@shared/jellyfin'
import {
  applyTrackChoice,
  needsRenegotiation,
  recallTracks,
  startPlayback,
  startTicksFor,
  stopTranscode,
  type PlaybackRequest,
  type PlaybackSettings,
  type ResolvedPlayback,
} from '@shared/playback'
import { getDeviceCaps } from '@/lib/deviceCaps'
import type { PlayParams } from '@/lib/routes'
import { ignore } from './time'

/** Remembered tracks are shared by all episodes of a series. */
export const trackKey = (item: BaseItem) => item.SeriesId ?? item.Id

export type TrackChange = { audioStreamIndex?: number; subtitleStreamIndex?: number }

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Wiedergabe fehlgeschlagen')

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
  const latest = useRef({ item, params, settings })

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
      const request: PlaybackRequest = {
        itemId: item.Id,
        mediaSourceId: source?.Id,
        startTicks: startTicksFor(item, params.start ?? 'resume', settings.resumeRewindSeconds),
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
  }, [session, itemId])

  const renegotiate = useCallback(
    async (change: Partial<PlaybackRequest>, positionTicks: number) => {
      const old = current.current
      const base = lastRequest.current
      if (!old || !base) return
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
        if (old.playMethod === 'Transcode') stopTranscode(session, old.playSessionId).catch(ignore)
        lastRequest.current = request
        current.current = resolved
        setPlayback(resolved)
      } catch (e) {
        setError(errorText(e))
      }
    },
    [session],
  )

  /** Audio or subtitle change: inside the player when possible, otherwise a new negotiation. */
  const changeTracks = useCallback(
    (change: TrackChange, positionTicks: number) => {
      const old = current.current
      if (!old) return
      if (needsRenegotiation(old, change)) return void renegotiate(change, positionTicks)
      const next = { ...old, ...change }
      current.current = next
      setPlayback(next)
    },
    [renegotiate],
  )

  const changeQuality = useCallback((maxBitrate: number, positionTicks: number) => void renegotiate({ maxBitrate }, positionTicks), [renegotiate])

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

  return { playback, error, setError, changeTracks, changeQuality, fallback, maxBitrate: lastRequest.current?.maxBitrate ?? settings.maxBitrate }
}
