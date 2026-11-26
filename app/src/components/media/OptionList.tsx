import { Check } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

export type Option = { value: string; label: string; hint?: string }

type Props = { title?: string; options: Option[]; value: string; onChange: (value: string) => void }

/** Radio style list, same look as the web OptionList in RequestButton. */
export function OptionList({ title, options, value, onChange }: Props) {
  return (
    <View className="gap-1">
      {title && <Text className="px-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</Text>}
      {options.map((option) => {
        const active = value === option.value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => {
              haptic.select()
              onChange(option.value)
            }}
            className="flex-row items-center gap-3 rounded-lg px-3 py-2.5 active:bg-accent"
          >
            <View className={cn('size-5 items-center justify-center rounded-full border border-input', active && 'border-primary bg-primary')}>
              {active && <Icon as={Check} size={14} color="primaryForeground" />}
            </View>
            <Text className="flex-1 font-medium" numberOfLines={1}>
              {option.label}
            </Text>
            {option.hint && <Text className="text-xs text-muted-foreground">{option.hint}</Text>}
          </Pressable>
        )
      })}
    </View>
  )
}
