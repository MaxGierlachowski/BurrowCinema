import { SkipForward } from 'lucide-react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

/**
 * "Intro überspringen" and friends. On TV it takes the focus while the controls are hidden, so Select presses it.
 * `focus` turning true again (controls hidden) moves the focus back here; the hidden controls took it along.
 */
export function SkipSegmentButton({ label, focus, onPress }: { label: string; focus: boolean; onPress: () => void }) {
  return (
    <Button
      variant="secondary"
      size="lg"
      icon={SkipForward}
      preferredFocus={focus}
      accessibilityLabel={label}
      onPress={onPress}
      className="bg-black/70"
    >
      <Text className="font-semibold">{label}</Text>
    </Button>
  )
}
