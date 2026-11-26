import type { NotificationPermissionsStatus } from 'expo-notifications'
import { Bell, BellOff, BellRing } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { AppState, Linking, View } from 'react-native'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { registerBackgroundCheck } from '@/lib/backgroundTask'
import { getPermission, requestPermission } from '@/lib/notifications'

/** Permission state of the system notifications, refreshed when the user comes back from the system settings. */
function usePermission() {
  const [status, setStatus] = useState<NotificationPermissionsStatus | null>(null)
  useEffect(() => {
    const refresh = () => getPermission().then(setStatus).catch(() => undefined)
    refresh()
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh())
    return () => subscription.remove()
  }, [])
  return [status, setStatus] as const
}

export function NotificationsCard() {
  const [status, setStatus] = usePermission()
  const granted = !!status?.granted
  const blocked = !!status && !granted && !status.canAskAgain

  useEffect(() => {
    if (granted) registerBackgroundCheck()
  }, [granted])

  const allow = async () => setStatus(await requestPermission())

  return (
    <Card>
      <CardTitle>Benachrichtigungen</CardTitle>
      <CardDescription>Einladungen zu Auslosungen, Start und Ende</CardDescription>
      <View className="flex-row items-center gap-3">
        <Icon as={granted ? BellRing : blocked ? BellOff : Bell} color={granted ? 'primary' : 'mutedForeground'} size={18} />
        <Text className="flex-1 text-sm text-muted-foreground">
          {!status ? 'Wird geprüft' : granted ? 'Erlaubt' : blocked ? 'In den Systemeinstellungen blockiert' : 'Noch nicht erlaubt'}
        </Text>
      </View>
      {status && !granted && (
        <Button variant="secondary" onPress={blocked ? () => Linking.openSettings() : allow}>
          {blocked ? 'Systemeinstellungen öffnen' : 'Benachrichtigungen erlauben'}
        </Button>
      )}
    </Card>
  )
}
