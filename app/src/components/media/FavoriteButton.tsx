import { Heart } from 'lucide-react-native'
import { setFavorite, type BaseItem } from '@shared/jellyfin'
import { colors } from '@shared/theme'
import { useUserDataToggle } from '@/components/media/WatchedButton'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

export function FavoriteButton({ item }: { item: BaseItem }) {
  const { value, toggle } = useUserDataToggle(item, 'IsFavorite', setFavorite)
  return (
    <Button
      size="lg"
      variant="secondary"
      className="w-12 px-0"
      haptics={false}
      accessibilityLabel={value ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: value }}
      onPress={toggle}
    >
      <Icon as={Heart} color={value ? 'destructive' : 'secondaryForeground'} fill={value ? colors.destructive : 'transparent'} />
    </Button>
  )
}
