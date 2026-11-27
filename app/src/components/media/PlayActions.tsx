import { router } from 'expo-router'
import { Play, RotateCcw } from 'lucide-react-native'
import { View } from 'react-native'
import { formatRuntime, ticksToMinutes } from '@shared/format'
import type { BaseItem } from '@shared/jellyfin'
import { shouldOfferResume } from '@shared/playback'
import { ProgressBar, progressPercent } from '@/components/media/MediaCard'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { features } from '@/lib/features'
import { playHref } from '@/lib/routes'

type Props = {
  item: BaseItem
  mediaSourceId?: string
  /** TV: the play button gets the focus when the screen opens. */
  preferredFocus?: boolean
  /** Shown next to the progress, e.g. "S1:F2" when the button plays an episode of a series page. */
  caption?: string
}

/** "Abspielen", or "Fortsetzen" plus "Von vorne" with a progress bar when the item was started. */
export function PlayActions({ item, mediaSourceId, preferredFocus, caption }: Props) {
  if (!features.player) return null
  const resume = shouldOfferResume(item)
  const percent = resume ? progressPercent(item) : undefined
  const left = item.RunTimeTicks
    ? formatRuntime(ticksToMinutes(item.RunTimeTicks - (item.UserData?.PlaybackPositionTicks ?? 0)))
    : undefined
  const play = (start: 'resume' | 'beginning') => router.push(playHref(item.Id, { start, mediaSourceId }))

  return (
    <>
      {(percent !== undefined || caption) && (
        <View className="w-full gap-1.5">
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {[caption, resume && left && `Noch ${left}`].filter(Boolean).join(' · ')}
          </Text>
          {percent !== undefined && <ProgressBar percent={percent} />}
        </View>
      )}
      <Button size="lg" icon={Play} preferredFocus={preferredFocus} onPress={() => play(resume ? 'resume' : 'beginning')}>
        {resume ? 'Fortsetzen' : 'Abspielen'}
      </Button>
      {resume && (
        <Button size="lg" variant="secondary" icon={RotateCcw} onPress={() => play('beginning')}>
          Von vorne
        </Button>
      )}
    </>
  )
}
