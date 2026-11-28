import { View } from 'react-native'
import type { MediaSourceInfo } from '@shared/jellyfin'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { Focusable } from '@/lib/tv'
import { cn } from '@/lib/utils'

type Props = { sources?: MediaSourceInfo[]; value?: string; onChange: (id: string) => void }

/** Choice of the file to play when a title has several versions (e.g. 4K and 1080p). No sheet, so it works with the D pad. */
export function VersionPicker({ sources = [], value, onChange }: Props) {
  if (sources.length < 2) return null
  const selected = value ?? sources[0].Id
  return (
    <View className="w-full gap-2">
      <Text className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Version</Text>
      <View className="flex-row flex-wrap gap-2">
        {sources.map((source, i) => {
          const active = source.Id === selected
          return (
            <Focusable
              key={source.Id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => {
                haptic.select()
                onChange(source.Id)
              }}
              className={cn('min-h-11 justify-center rounded-lg border border-input px-3', active && 'border-primary bg-primary/15')}
            >
              <Text className="text-sm font-medium" numberOfLines={1}>
                {source.Name || `Version ${i + 1}`}
              </Text>
            </Focusable>
          )
        })}
      </View>
    </View>
  )
}
