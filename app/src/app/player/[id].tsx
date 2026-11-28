import { useLocalSearchParams } from 'expo-router'
import { CastScreen } from '@/components/player/CastScreen'
import { PlayerScreen } from '@/components/player/PlayerScreen'
import { useCasting } from '@/lib/cast'
import type { PlayParams } from '@/lib/routes'

type SearchParams = { id: string; start?: string; mediaSourceId?: string; audio?: string; sub?: string }

const toNumber = (value?: string) => (value === undefined || value === '' || Number.isNaN(Number(value)) ? undefined : Number(value))

export default function PlayerRoute() {
  const { id, start, mediaSourceId, audio, sub } = useLocalSearchParams<SearchParams>()
  const casting = useCasting()
  const params: PlayParams = {
    start: start === 'beginning' ? 'beginning' : 'resume',
    mediaSourceId,
    audio: toNumber(audio),
    sub: toNumber(sub),
  }
  // A new key per item: the next episode (router.replace) starts with fresh player state.
  // Connecting or disconnecting a Chromecast swaps the screens; the position goes along (lib/cast.tsx).
  return casting ? <CastScreen key={id} id={id} params={params} /> : <PlayerScreen key={id} id={id} params={params} />
}
