import { Check, X } from 'lucide-react-native'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'
import { Focusable, FocusGuide } from '@/lib/tv'
import { cn } from '@/lib/utils'

export type PanelOption = { value: string; label: string; hint?: string }

type Props = { title: string; options: PanelOption[]; value: string; onSelect: (value: string) => void; onClose: () => void }

/** Side panel for tracks, quality, speed, format and chapters. No Modal: it lives inside the player and traps the TV focus. */
export function TrackPanel({ title, options, value, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <FocusGuide
      autoFocus
      trapFocusLeft
      trapFocusRight
      trapFocusUp
      trapFocusDown
      className="absolute top-0 right-0 bottom-0 w-80 bg-popover/95"
      style={{ paddingTop: insets.top + 12, paddingRight: insets.right }}
    >
      <View className="flex-row items-center justify-between pr-2 pl-5">
        <Text className="text-lg font-semibold">{title}</Text>
        <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Schließen" onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: insets.bottom + 16 }}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <Focusable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={option.label}
              preferredFocus={active}
              onPress={() => {
                haptic.select()
                onSelect(option.value)
              }}
              className="flex-row items-center gap-3 rounded-lg px-3 py-3"
              focusedClassName="bg-accent"
            >
              <View className="w-5">{active && <Icon as={Check} size={18} color="primary" />}</View>
              <Text className={cn('flex-1 font-medium', active && 'text-primary')} numberOfLines={1}>
                {option.label}
              </Text>
              {option.hint && <Text className="text-xs text-muted-foreground">{option.hint}</Text>}
            </Focusable>
          )
        })}
      </ScrollView>
    </FocusGuide>
  )
}
