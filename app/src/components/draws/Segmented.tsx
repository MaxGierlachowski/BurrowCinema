import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

type Props<T extends string> = { value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; className?: string }

/** Native counterpart of the web Tabs list: a row of equally wide segments. */
export function Segmented<T extends string>({ value, onChange, options, className }: Props<T>) {
  return (
    <View className={cn('flex-row rounded-xl bg-muted p-1', className)} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return
              haptic.select()
              onChange(option.value)
            }}
            className={cn('h-9 flex-1 items-center justify-center rounded-lg', active && 'bg-background')}
          >
            <Text className={cn('text-sm font-medium', !active && 'text-muted-foreground')}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
