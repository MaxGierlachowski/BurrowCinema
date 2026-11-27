import { router } from 'expo-router'
import { Play } from 'lucide-react-native'
import { View } from 'react-native'
import { formatRuntime, ticksToMinutes } from '@shared/format'
import type { BaseItem } from '@shared/jellyfin'
import { shouldOfferResume } from '@shared/playback'
import { Thumb } from '@/components/media/MediaCard'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { features } from '@/lib/features'
import { haptic } from '@/lib/haptics'
import { itemHref, playHref } from '@/lib/routes'
import { Focusable } from '@/lib/tv'

/** The episode to continue with: one in progress, else the first unwatched, else the first. */
export function nextEpisodeOf(episodes: BaseItem[]) {
  return episodes.find(shouldOfferResume) ?? episodes.find((e) => !e.UserData?.Played) ?? episodes[0]
}

function EpisodeRow({ episode, preferredFocus }: { episode: BaseItem; preferredFocus?: boolean }) {
  const number = episode.IndexNumber
  const runtime = formatRuntime(ticksToMinutes(episode.RunTimeTicks))
  return (
    <View className="flex-row items-start gap-2">
      <Focusable
        preferredFocus={preferredFocus}
        onPress={() => {
          haptic.tap()
          router.push(itemHref(episode.Id))
        }}
        className="flex-1 gap-2 rounded-xl p-1"
      >
        <View className="flex-row gap-3">
          <Thumb item={episode} className="w-36" />
          <View className="min-w-0 flex-1 justify-center gap-0.5">
            <View className="flex-row gap-2">
              {number !== undefined && <Text className="text-xs text-muted-foreground">Folge {number}</Text>}
              {runtime && <Text className="text-xs text-muted-foreground">{runtime}</Text>}
            </View>
            <Text className="font-medium" numberOfLines={2}>
              {episode.Name}
            </Text>
          </View>
        </View>
        {!!episode.Overview && (
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {episode.Overview}
          </Text>
        )}
      </Focusable>
      {features.player && (
        <Button
          variant="ghost"
          size="icon"
          icon={Play}
          accessibilityLabel={number !== undefined ? `Folge ${number} abspielen` : 'Folge abspielen'}
          onPress={() => router.push(playHref(episode.Id, { start: shouldOfferResume(episode) ? 'resume' : 'beginning' }))}
        />
      )}
    </View>
  )
}

/** Episodes of a season: number, title, runtime, two lines of overview, watched mark and progress. */
export function EpisodeList({ episodes, focusId }: { episodes: BaseItem[]; focusId?: string }) {
  return (
    <View className="gap-3">
      {episodes.map((episode) => (
        <EpisodeRow key={episode.Id} episode={episode} preferredFocus={episode.Id === focusId} />
      ))}
    </View>
  )
}
