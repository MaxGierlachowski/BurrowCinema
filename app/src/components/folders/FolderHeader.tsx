import { ChevronLeft, Ellipsis } from 'lucide-react-native'
import { View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'

type Props = {
  title?: string
  subtitle?: string
  onBack: () => void
  onActions?: () => void
}

/** Header of the folder stack screen: round back button, title and an actions button. */
export function FolderHeader({ title, subtitle, onBack, onActions }: Props) {
  return (
    <View className="flex-row items-center gap-3 px-4 pt-2 pb-4">
      <Button variant="secondary" size="icon" icon={ChevronLeft} className="rounded-full" accessibilityLabel="Zurück" onPress={onBack} />
      <View className="flex-1">
        {title && (
          <Text className="text-2xl font-bold tracking-tight" numberOfLines={1}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {onActions && (
        <Button
          variant="secondary"
          size="icon"
          icon={Ellipsis}
          className="rounded-full"
          accessibilityLabel="Ordner Aktionen"
          onPress={onActions}
        />
      )}
    </View>
  )
}
