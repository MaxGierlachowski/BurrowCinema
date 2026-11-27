import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getAdjacentEpisodes, getMe, type BaseItem, type Session } from '@shared/jellyfin'
import type { MediaSegment, PlaybackSettings } from '@shared/playback'
import { qk } from '@/lib/queryKeys'

/** The card appears this many seconds before the end (or when the credits start). */
const SHOW_BEFORE_END = 20
/** After this many episodes in a row without any input, ask "Schaust du noch?" instead of playing on. */
const STILL_WATCHING_AFTER = 3

let autoPlayedInRow = 0

/** Any input in the player shows someone is watching. */
export function noteInteraction() {
  autoPlayedInRow = 0
}

type Options = {
  position: number
  duration: number
  segment?: MediaSegment
  paused: boolean
  settings: PlaybackSettings
  onPlay: (episode: BaseItem) => void
}

/** Next episode with countdown. Auto play needs both the Jellyfin user setting and the device setting. */
export function useUpNext(session: Session, item: BaseItem, { position, duration, segment, paused, settings, onPlay }: Options) {
  const isEpisode = item.Type === 'Episode' && !!item.SeriesId
  const { data: adjacent } = useQuery({
    queryKey: ['adjacent-episodes', item.Id],
    queryFn: () => getAdjacentEpisodes(session, item.SeriesId!, item.Id),
    enabled: isEpisode,
  })
  const { data: me } = useQuery({ queryKey: qk.me, queryFn: () => getMe(session), staleTime: 5 * 60_000, enabled: isEpisode })
  const next = adjacent?.next
  const autoPlay = settings.autoPlayNext && !!me?.Configuration?.EnableNextEpisodeAutoPlay

  const [dismissed, setDismissed] = useState(false)
  const [opened, setOpened] = useState(false)
  const [stillWatching, setStillWatching] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(settings.autoPlayNextSeconds)
  const nearEnd = duration > 0 && duration - position < SHOW_BEFORE_END
  const visible = !!next && !dismissed && !stillWatching && (opened || segment?.Type === 'Outro' || nearEnd)

  const latest = useRef(onPlay)
  useEffect(() => {
    latest.current = onPlay
  })

  // Leaving the player any other way than by auto play (back, close, a chosen episode) starts the count again,
  // so the next session from the library does not ask "Schaust du noch?" right away.
  const autoPlayed = useRef(false)
  useEffect(
    () => () => {
      if (!autoPlayed.current) noteInteraction()
    },
    [],
  )

  useEffect(() => {
    if (!visible) setSecondsLeft(settings.autoPlayNextSeconds)
  }, [visible, settings.autoPlayNextSeconds])

  const counting = visible && autoPlay && !paused
  useEffect(() => {
    if (!counting) return
    const timer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [counting])

  const due = counting && secondsLeft === 0
  useEffect(() => {
    if (!due || !next) return
    if (autoPlayedInRow >= STILL_WATCHING_AFTER) return setStillWatching(true)
    autoPlayedInRow++
    autoPlayed.current = true
    latest.current(next)
  }, [due, next])

  return {
    next,
    previous: adjacent?.previous,
    visible,
    autoPlay,
    secondsLeft,
    stillWatching,
    /** "Abspann überspringen" opens the card. */
    open: () => {
      setDismissed(false)
      setOpened(true)
    },
    cancel: () => {
      setDismissed(true)
      setOpened(false)
    },
    playNow: () => {
      noteInteraction()
      if (next) latest.current(next)
    },
    /** End of the episode: play on right away when allowed, otherwise keep the card open. */
    ended: () => {
      setDismissed(false)
      setOpened(true)
      if (autoPlay) setSecondsLeft(0)
    },
    keepWatching: () => {
      noteInteraction()
      setStillWatching(false)
      if (next) latest.current(next)
    },
  }
}
