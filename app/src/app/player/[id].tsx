import { DetailMessage } from '@/components/media/DetailLayout'
import { Text } from '@/components/ui/text'

// Placeholder until the player (work package A) replaces it.
export default function PlayerRoute() {
  return (
    <DetailMessage>
      <Text className="text-muted-foreground">Wiedergabe folgt in Kürze.</Text>
    </DetailMessage>
  )
}
