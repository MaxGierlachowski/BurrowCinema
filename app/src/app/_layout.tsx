import '@/lib/platform'
import '../global.css'

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { useQuery } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack, type ErrorBoundaryProps } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Toaster } from 'sonner-native'
import { rememberBundledServer } from '@shared/draws'
import { AuthProvider, useAuth } from '@shared/hooks/useAuth'
import { colors } from '@shared/theme'
import { syncSettings } from '@shared/userSettings'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { persistOptions, queryClient } from '@/lib/queryClient'
// Auslosung: defines the background task at module level, registers it and opens tapped notifications.
import { useDrawNotifications } from '@/lib/backgroundTask'

SplashScreen.preventAutoHideAsync()

/** Errors while rendering a screen show a message with retry instead of closing the app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])
  return (
    <View className="flex-1 justify-center gap-4 bg-background px-6">
      <Text className="text-2xl font-bold">Etwas ist schiefgelaufen</Text>
      <Text selectable className="text-sm text-muted-foreground">
        {error.message}
      </Text>
      <Button onPress={retry}>Erneut versuchen</Button>
    </View>
  )
}

function RootNavigator() {
  const { session } = useAuth()
  // Radarr, Sonarr and server settings live in the Jellyfin profile; load them before any screen reads them.
  const settings = useQuery({
    queryKey: ['user-settings', session?.userId],
    queryFn: async () => {
      const result = await syncSettings(session!)
      rememberBundledServer()
      return result
    },
    enabled: !!session,
    staleTime: Infinity,
  })
  const ready = !session || !settings.isPending
  useDrawNotifications(ready && !!session) // Auslosung notifications

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade_from_bottom' }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="item/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="external/[source]/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="folders/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="draws/new" />
        <Stack.Screen name="draws/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="draws/stats" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <BottomSheetModalProvider>
            <RootNavigator />
            <Toaster
              theme="dark"
              position="top-center"
              toastOptions={{ style: { backgroundColor: colors.popover, borderColor: colors.border, borderWidth: 1 } }}
            />
          </BottomSheetModalProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  )
}
