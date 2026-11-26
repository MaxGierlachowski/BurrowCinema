import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { CircleCheck, LogOut } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { ARR_LABEL, getArrSettings, type ArrKind } from '@shared/arr'
import { getDrawServer } from '@shared/draws'
import { useAuth, useSession } from '@shared/hooks/useAuth'
import { NotificationsCard } from '@/components/draws/NotificationsCard'
import { PageHeader, Screen } from '@/components/Screen'
import { ARR_HINT, ArrForm } from '@/components/settings/ArrForm'
import { DRAW_SERVER_HINT, DrawServerForm } from '@/components/settings/DrawServerForm'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'

function ConnectedTitle({ children, connected }: { children: string; connected: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      <CardTitle>{children}</CardTitle>
      {connected && <Icon as={CircleCheck} color="like" size={16} />}
    </View>
  )
}

function SettingsCard({ title, connected, hint, children }: { title: string; connected: boolean; hint: string; children: ReactNode }) {
  return (
    <Card>
      <ConnectedTitle connected={connected}>{title}</ConnectedTitle>
      <CardDescription>{hint}</CardDescription>
      {children}
    </Card>
  )
}

function ArrCard({ kind }: { kind: ArrKind }) {
  const [connected, setConnected] = useState(() => Boolean(getArrSettings()[kind]))
  return (
    <SettingsCard title={ARR_LABEL[kind]} connected={connected} hint={ARR_HINT(kind)}>
      <ArrForm kind={kind} onChange={setConnected} />
    </SettingsCard>
  )
}

function DrawServerCard() {
  const [connected, setConnected] = useState(() => Boolean(getDrawServer()))
  return (
    <SettingsCard title="Auslosung" connected={connected} hint={DRAW_SERVER_HINT}>
      <DrawServerForm onChange={setConnected} />
    </SettingsCard>
  )
}

function JellyfinCard() {
  const session = useSession()
  const { signOut } = useAuth()

  const confirmSignOut = () =>
    Alert.alert('Abmelden', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Abmelden',
        style: 'destructive',
        onPress: () => {
          // Reminders belong to this user; the next person on this device should not get them.
          Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined)
          signOut()
        },
      },
    ])

  return (
    <Card>
      <CardTitle>Jellyfin</CardTitle>
      <CardDescription>
        Angemeldet als <Text className="text-sm text-foreground">{session.userName}</Text> auf {session.server}
      </CardDescription>
      <Button variant="secondary" size="lg" icon={LogOut} className="self-start" onPress={confirmSignOut}>
        Abmelden
      </Button>
    </Card>
  )
}

export default function Settings() {
  const version = Constants.expoConfig?.version
  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerClassName="px-4 pb-10" keyboardShouldPersistTaps="handled">
          <View className="mx-auto w-full max-w-2xl">
            <PageHeader title="Einstellungen" />
            <View className="gap-4">
              <JellyfinCard />
              <ArrCard kind="radarr" />
              <ArrCard kind="sonarr" />
              <DrawServerCard />
              <NotificationsCard />
              <Text className="px-1 text-xs text-muted-foreground">
                API Keys, Server Adressen und Ordner werden in deinem Jellyfin Profil gespeichert und sind auf allen
                Geräten verfügbar.
              </Text>
              {version && <Text className="px-1 text-xs text-muted-foreground">Version {version}</Text>}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
