import { Pressable, View } from 'react-native'
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
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return
              haptic.select()
              onChange(option.value)
            }}
            className={cn('rounded-lg px-4 py-1.5', active && 'bg-background')}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
