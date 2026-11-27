import type { LucideIcon } from 'lucide-react-native'
import { colors } from '@shared/theme'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { Focusable } from '@/lib/tv'
import { cn } from '@/lib/utils'

/** TabList is not styled by Uniwind (TabTriggers must be its direct children), so the sidebar style is plain. */
export const sidebarStyle = {
  width: 240,
  flexDirection: 'column',
  justifyContent: 'flex-start',
  gap: 4,
  // Inside the TV overscan safe area (about 5 % of the screen).
  paddingLeft: 24,
  paddingRight: 12,
  paddingVertical: 32,
  backgroundColor: colors.card,
  borderRightWidth: 1,
  borderRightColor: colors.border,
} as const

type Props = {
  icon: LucideIcon
  label: string
  /** Set by TabTrigger (asChild) on the active tab. */
  isFocused?: boolean
  onPress?: () => void
}

/** Entry of the TV sidebar. Inside a TabTrigger (asChild) the trigger passes isFocused and onPress. */
export function SidebarItem({ icon, label, isFocused, onPress }: Props) {
  return (
    <Focusable
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      // Called without the press event: TabTrigger handles a missing event, and TV presses may carry a partial one.
      onPress={() => onPress?.()}
      className={cn('flex-row items-center gap-4 rounded-xl px-4 py-3', isFocused && 'bg-accent')}
    >
      {({ focused }) => (
        <>
          <Icon as={icon} color={isFocused || focused ? 'primary' : 'mutedForeground'} size={24} />
          <Text className={cn('text-lg', isFocused || focused ? 'font-semibold' : 'text-muted-foreground')}>{label}</Text>
        </>
      )}
    </Focusable>
  )
}
