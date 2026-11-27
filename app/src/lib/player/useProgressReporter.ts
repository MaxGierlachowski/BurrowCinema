import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { BaseItem, Session } from '@shared/jellyfin'
import {
  PROGRESS_INTERVAL_MS,
  reportPlaybackProgress,
  reportPlaybackStart,
  reportPlaybackStopped,
  secondsToTicks,
  stopTranscode,
  type ResolvedPlayback,
} from '@shared/playback'
import { invalidateAfterPlayback } from '@/lib/queryKeys'
import { ignore } from './time'

/**
 * Tells Jellyfin what is playing: Playing once per play session after the first load, a heartbeat every 10 s
 * (driven by the player's progress events, because Android pauses JS timers in the background), an extra report
 * on pause, resume, seek and track changes, and Stopped exactly once per play session.
 */
class ProgressReporter {
  private item?: BaseItem
  private playback?: ResolvedPlayback
  private position = 0
  private paused = false
  private lastReport = 0
  private readonly started = new Set<string>()
  private readonly stopped = new Set<string>()

  private readonly session: Session
  private readonly client: QueryClient

  constructor(session: Session, client: QueryClient) {
    this.session = session
    this.client = client
  }

  bind(item: BaseItem | undefined, playback: ResolvedPlayback | undefined) {
    const before = this.playback
    this.item = item
    this.playback = playback
    const sameSession = before && playback && before.playSessionId === playback.playSessionId
    if (sameSession && (before.audioStreamIndex !== playback.audioStreamIndex || before.subtitleStreamIndex !== playback.subtitleStreamIndex)) {
      this.now()
    }
  }

  private report() {
    const { item, playback } = this
    if (!item || !playback || this.stopped.has(playback.playSessionId)) return undefined
    return {
      itemId: item.Id,
      mediaSourceId: playback.mediaSource.Id,
      playSessionId: playback.playSessionId,
      positionTicks: secondsToTicks(this.position),
      isPaused: this.paused,
      playMethod: playback.playMethod,
      audioStreamIndex: playback.audioStreamIndex,
      subtitleStreamIndex: playback.subtitleStreamIndex,
    }
  }

  /** The player loaded the stream of the current play session. */
  loaded(positionSeconds: number) {
    this.position = positionSeconds
    const report = this.report()
    if (!report || this.started.has(report.playSessionId)) return
    this.started.add(report.playSessionId)
    this.lastReport = Date.now()
    const startTicks = this.playback?.startTicks ?? report.positionTicks
    reportPlaybackStart(this.session, { ...report, positionTicks: startTicks, isPaused: false }).catch(ignore)
  }

  /** Called with every progress event of the player (about once per second). */
  progress(positionSeconds: number) {
    this.position = positionSeconds
    if (Date.now() - this.lastReport >= PROGRESS_INTERVAL_MS) this.now()
  }

  seeked(positionSeconds: number) {
    this.position = positionSeconds
    this.now()
  }

  setPaused(paused: boolean) {
    if (paused === this.paused) return
    this.paused = paused
    this.now()
  }

  /** Immediate progress report, only after Playing was sent for this play session. */
  now() {
    const report = this.report()
    if (!report || !this.started.has(report.playSessionId)) return
    this.lastReport = Date.now()
    reportPlaybackProgress(this.session, report).catch(ignore)
  }

  /** Stopped once per play session, then the transcode is ended and screens showing progress are refreshed. */
  async stop(failed = false) {
    const { item, playback } = this
    if (!item || !playback || this.stopped.has(playback.playSessionId)) return
    this.stopped.add(playback.playSessionId)
    const { session } = this
    await reportPlaybackStopped(session, {
      itemId: item.Id,
      mediaSourceId: playback.mediaSource.Id,
      playSessionId: playback.playSessionId,
      positionTicks: secondsToTicks(this.position),
      failed,
    }).catch(ignore)
    if (playback.playMethod === 'Transcode') await stopTranscode(session, playback.playSessionId).catch(ignore)
    await invalidateAfterPlayback(this.client, item).catch(ignore)
  }
}

export function useProgressReporter(session: Session, item: BaseItem | undefined, playback: ResolvedPlayback | undefined) {
  const client = useQueryClient()
  const [reporter] = useState(() => new ProgressReporter(session, client))
  useEffect(() => reporter.bind(item, playback), [reporter, item, playback])
  // Leaving the player (back, close, next episode) unmounts it.
  useEffect(() => () => void reporter.stop(), [reporter])
  return reporter
}
