import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Info, Play } from 'lucide-react-native'
import { useWindowDimensions, View } from 'react-native'
import { formatRating, formatRuntime, ticksToMinutes } from '@shared/format'
import { useSession } from '@shared/hooks/useAuth'
import { backdropUrl, type BaseItem } from '@shared/jellyfin'
import { shouldOfferResume } from '@shared/playback'
import { colors } from '@shared/theme'
import { useLatest, useLibraryViews, useResume } from '@/components/home/HomeRows'
import { episodeCode, ProgressBar, progressPercent } from '@/components/media/MediaCard'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { features } from '@/lib/features'
import { itemHref, playHref } from '@/lib/routes'

/** The first title to continue, otherwise the newest movie. */
function useHeroItem(): BaseItem | undefined {
  const resume = useResume()
  const views = useLibraryViews()
  const movies = views.data?.find((view) => view.CollectionType === 'movies')
  const latest = useLatest(resume.data?.length ? undefined : movies?.Id)
  return resume.data?.[0] ?? latest.data?.[0]
}

/** Big featured title at the top of the TV home with "Fortsetzen"/"Abspielen" and "Details". */
export function TvHero({ preferredFocus }: { preferredFocus?: boolean }) {
  const session = useSession()
  const { height } = useWindowDimensions()
  const item = useHeroItem()
  if (!item) return null

  const resume = shouldOfferResume(item)
  const percent = progressPercent(item)
  const code = episodeCode(item)
  const meta = [
    code ? `${code} · ${item.Name}` : item.ProductionYear?.toString(),
    formatRuntime(ticksToMinutes(item.RunTimeTicks)),
    item.OfficialRating,
    formatRating(item.CommunityRating),
  ]
  const backdrop = backdropUrl(session, item, 1920)

  return (
    <View className="-mx-8 justify-end overflow-hidden" style={{ height: height * 0.5 }}>
      {!!backdrop && <Image source={backdrop} contentFit="cover" transition={200} style={{ position: 'absolute', inset: 0 }} />}
      <LinearGradient
        colors={[`${colors.background}00`, `${colors.background}b0`, colors.background]}
        style={{ position: 'absolute', inset: 0 }}
      />
      <LinearGradient
        colors={[`${colors.background}e0`, `${colors.background}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <View className="w-1/2 gap-2 px-8 pb-2">
        <Text className="text-3xl leading-tight font-bold tracking-tight" numberOfLines={2}>
          {item.Type === 'Episode' ? (item.SeriesName ?? item.Name) : item.Name}
        </Text>
        <Text className="text-sm text-muted-foreground">{meta.filter(Boolean).join(' · ')}</Text>
        {!!item.Overview && (
          <Text className="text-sm leading-relaxed text-muted-foreground" numberOfLines={3}>
            {item.Overview}
          </Text>
        )}
        {percent !== undefined && <ProgressBar percent={percent} className="w-64" />}
        <View className="mt-2 flex-row gap-3">
          {features.player && (
            <Button
              icon={Play}
              preferredFocus={preferredFocus}
              onPress={() => router.push(playHref(item.Id, { start: resume ? 'resume' : 'beginning' }))}
            >
              {resume ? 'Fortsetzen' : 'Abspielen'}
            </Button>
          )}
          <Button
            variant="secondary"
            icon={Info}
            preferredFocus={preferredFocus && !features.player}
            onPress={() => router.push(itemHref(item.Id))}
          >
            Details
          </Button>
        </View>
      </View>
    </View>
  )
}
