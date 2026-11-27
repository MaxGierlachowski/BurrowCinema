import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import type { Session } from '@shared/jellyfin'
import { getMediaSegments, segmentAt, TICKS_PER_SECOND, type MediaSegment, type PlaybackSettings, type SegmentAction } from '@shared/playback'

export const segmentAction = (segment: MediaSegment, actions: PlaybackSettings['segmentActions']): SegmentAction =>
  segment.Type === 'Unknown' ? 'off' : actions[segment.Type]

/**
 * The segment at the current position whose action is not 'off'. Auto skip only fires when playback runs into
 * the segment by itself (previous position at or just before its start, small step), never after a seek into it.
 */
export function useSegments(
  session: Session,
  itemId: string,
  positionTicks: number,
  actions: PlaybackSettings['segmentActions'],
  onAutoSkip: (segment: MediaSegment) => void,
) {
  const { data = [] } = useQuery({
    queryKey: ['media-segments', itemId],
    queryFn: () => getMediaSegments(session, itemId),
    staleTime: Infinity,
  })
  const segment = segmentAt(
    data.filter((s) => segmentAction(s, actions) !== 'off'),
    positionTicks,
  )
  const previous = useRef<number | undefined>(undefined)
  const latest = useRef(onAutoSkip)
  useEffect(() => {
    latest.current = onAutoSkip
  })

  useEffect(() => {
    const before = previous.current
    previous.current = positionTicks
    if (!segment || before === undefined || segmentAction(segment, actions) !== 'auto') return
    const natural = before <= segment.StartTicks + TICKS_PER_SECOND && positionTicks - before >= 0 && positionTicks - before < 3 * TICKS_PER_SECOND
    if (natural) latest.current(segment)
  }, [positionTicks, segment, actions])

  return segment
}
