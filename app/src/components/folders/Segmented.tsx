import { View } from 'react-native'
import { Focusable } from '@/lib/tv'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'
import { Text } from '@/components/ui/text'

type Props<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** Segmented control, the native counterpart of the web Tabs list. */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View className="flex-row self-start rounded-xl bg-muted p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <Focusable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => {
              if (active) return
              haptic.select()
              onChange(option.value)
            }}
            className={cn('h-9 justify-center rounded-lg px-4', active && 'bg-background')}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{option.label}</Text>
          </Focusable>
        )
      })}
    </View>
  )
}
