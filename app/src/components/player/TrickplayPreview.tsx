import { Image } from 'expo-image'
import { View } from 'react-native'
import type { TrickplayTile } from '@shared/playback'
import { Text } from '@/components/ui/text'
import { formatTime } from '@/lib/player/time'

/** One thumbnail cut out of a trickplay sheet: the sheet is drawn at its real size and shifted inside a clipping view. */
export function TrickplayPreview({ tile, seconds, width = 192 }: { tile?: TrickplayTile; seconds: number; width?: number }) {
  const scale = tile ? width / tile.width : 1
  return (
    <View className="items-center gap-1">
      {tile && (
        <View
          className="overflow-hidden rounded-md border border-white/20 bg-black"
          style={{ width: tile.width * scale, height: tile.height * scale }}
        >
          <Image
            source={tile.url}
            cachePolicy="memory-disk"
            contentFit="fill"
            style={{
              position: 'absolute',
              left: -tile.x * scale,
              top: -tile.y * scale,
              width: tile.sheetWidth * scale,
              height: tile.sheetHeight * scale,
            }}
          />
        </View>
      )}
      <Text className="rounded bg-black/70 px-2 py-0.5 text-sm font-semibold text-foreground">{formatTime(seconds)}</Text>
    </View>
  )
}
