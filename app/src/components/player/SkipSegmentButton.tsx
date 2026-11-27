import { SkipForward } from 'lucide-react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

/** "Intro überspringen" and friends. On TV it takes the focus, so Select presses it. */
export function SkipSegmentButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button variant="secondary" size="lg" icon={SkipForward} preferredFocus accessibilityLabel={label} onPress={onPress} className="bg-black/70">
      <Text className="font-semibold">{label}</Text>
    </Button>
  )
}
