import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { FocusGuide } from '@/lib/tv'

/** Shown instead of the next episode after several automatic episodes without any input. */
export function StillWatching({ onContinue, onExit }: { onContinue: () => void; onExit: () => void }) {
  return (
    <View className="absolute inset-0 items-center justify-center bg-black/80 px-6">
      <FocusGuide autoFocus trapFocusUp trapFocusDown trapFocusLeft trapFocusRight className="items-center gap-5">
        <Text className="text-2xl font-bold">Schaust du noch?</Text>
        <View className="flex-row gap-3">
          <Button size="lg" preferredFocus onPress={onContinue}>
            Weiter schauen
          </Button>
          <Button size="lg" variant="secondary" onPress={onExit}>
            Beenden
          </Button>
        </View>
      </FocusGuide>
    </View>
  )
}
