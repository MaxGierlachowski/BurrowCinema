import { Image } from 'expo-image'
import { Play } from 'lucide-react-native'
import { View } from 'react-native'
import { useSession } from '@shared/hooks/useAuth'
import { thumbUrl, type BaseItem } from '@shared/jellyfin'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { FocusGuide, isTV } from '@/lib/tv'

export const episodeCode = (item: BaseItem) =>
  item.ParentIndexNumber !== undefined && item.IndexNumber !== undefined ? `S${item.ParentIndexNumber}:F${item.IndexNumber}` : undefined

type Props = { episode: BaseItem; secondsLeft?: number; focus: boolean; onPlay: () => void; onCancel: () => void }

/** "Nächste Folge" card with optional countdown. On TV "Jetzt abspielen" takes the focus while the controls are hidden. */
export function UpNextCard({ episode, secondsLeft, focus, onPlay, onCancel }: Props) {
  const session = useSession()
  const image = thumbUrl(session, episode, 400)
  return (
    <FocusGuide autoFocus className="w-80 gap-3 rounded-2xl border border-white/10 bg-black/80 p-4">
      <Text className="text-xs font-medium tracking-wide text-foreground/70 uppercase">Nächste Folge</Text>
      <View className="flex-row gap-3">
        {image && <Image source={image} contentFit="cover" style={{ width: 112, height: 63, borderRadius: 8 }} />}
        <View className="min-w-0 flex-1">
          <Text className="font-semibold" numberOfLines={2}>
            {[episodeCode(episode), episode.Name].filter(Boolean).join(' · ')}
          </Text>
          {secondsLeft !== undefined && <Text className="text-sm text-foreground/70">Startet in {secondsLeft} s</Text>}
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button size={isTV ? 'sm' : 'default'} icon={Play} preferredFocus={focus} onPress={onPlay} className="flex-1">
          Jetzt abspielen
        </Button>
        <Button size={isTV ? 'sm' : 'default'} variant="secondary" onPress={onCancel}>
          Abbrechen
        </Button>
      </View>
    </FocusGuide>
  )
}
