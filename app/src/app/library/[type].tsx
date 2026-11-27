import { useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BackButton } from '@/components/media/DetailLayout'
import { LibraryGrid } from '@/components/media/LibraryGrid'
import { isTV } from '@/lib/tv'

/** Full grid of one type, opened from "Alle Filme"/"Alle Serien" on TV. */
export default function LibraryScreen() {
  const { type } = useLocalSearchParams<{ type: string }>()
  const insets = useSafeAreaInsets()
  const series = type === 'Series'
  return (
    // Phones: room for the floating back button above the title.
    <View className="flex-1 bg-background" style={{ paddingTop: isTV ? 16 : insets.top + 48 }}>
      <LibraryGrid key={type} title={series ? 'Serien' : 'Filme'} type={series ? 'Series' : 'Movie'} paddingBottom={insets.bottom + 24} />
      <BackButton />
    </View>
  )
}
