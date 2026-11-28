import { X } from 'lucide-react-native'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { haptic } from '@/lib/haptics'

/** Small round X on a poster to take it out of the folder. */
export function RemoveButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Button
      size="icon-sm"
      variant="secondary"
      haptics={false}
      accessibilityLabel={`${title} entfernen`}
      hitSlop={8}
      className="size-7 rounded-full bg-black/60"
      onPress={() => {
        haptic.select()
        onPress()
      }}
    >
      <Icon as={X} size={16} />
    </Button>
  )
}
