import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { CalendarClock } from 'lucide-react-native'
import { Platform, Pressable, View } from 'react-native'
import { formatDate } from '@shared/draws'
import { colors } from '@shared/theme'
import { Icon } from '@/components/ui/icon'
import { Label } from '@/components/ui/label'
import { Text } from '@/components/ui/text'
import { haptic } from '@/lib/haptics'

type Props = { label: string; value: number; onChange: (ms: number) => void }

/** Android has no combined picker, so the date dialog is followed by the time dialog. */
function pickOnAndroid(value: number, onChange: (ms: number) => void) {
  DateTimePickerAndroid.open({
    value: new Date(value),
    mode: 'date',
    onChange: (event, date) => {
      if (event.type !== 'set' || !date) return
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        is24Hour: true,
        onChange: (e, time) => {
          if (e.type === 'set' && time) onChange(time.getTime())
        },
      })
    },
  })
}

export function DateTimeField({ label, value, onChange }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <View className="flex-row items-center justify-between">
        <Label>{label}</Label>
        <DateTimePicker
          value={new Date(value)}
          mode="datetime"
          display="compact"
          locale="de-DE"
          themeVariant="dark"
          accentColor={colors.primary}
          onChange={(_, date) => date && onChange(date.getTime())}
        />
      </View>
    )
  }
  return (
    <View>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          haptic.tap()
          pickOnAndroid(value, onChange)
        }}
        className="h-12 flex-row items-center justify-between rounded-xl border border-input bg-card px-4 active:opacity-80"
      >
        <Text>{formatDate(value)}</Text>
        <Icon as={CalendarClock} color="mutedForeground" size={18} />
      </Pressable>
    </View>
  )
}
