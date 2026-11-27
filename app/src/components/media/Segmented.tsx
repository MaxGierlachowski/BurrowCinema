import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { Focusable } from '@/lib/tv'
import { cn } from '@/lib/utils'

type Props<T extends string> = { value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; className?: string }

/** Segmented control styled like the web TabsList. */
export function Segmented<T extends string>({ value, onChange, options, className }: Props<T>) {
  return (
    <View accessibilityRole="tablist" className={cn('h-10 flex-row rounded-lg bg-muted p-[3px]', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Focusable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return
              haptic.select()
              onChange(option.value)
            }}
            className={cn('flex-1 items-center justify-center rounded-md border border-transparent', active && 'border-input bg-input/30')}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{option.label}</Text>
          </Focusable>
        )
      })}
    </View>
  )
}
