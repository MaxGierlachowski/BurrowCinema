import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import type { Session } from '@shared/jellyfin'
import { initiateQuickConnect, isQuickConnectAuthorized, loginWithQuickConnect, quickConnectEnabled } from '@shared/quickConnect'
import { colors } from '@shared/theme'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { useBackHandler } from '@/lib/tv'

const POLL_MS = 1000
const CODE_LIFETIME_MS = 10 * 60_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function errorText(err: unknown) {
  return err instanceof TypeError ? 'Server nicht erreichbar. Stimmt die Adresse?' : (err as Error).message
}

/**
 * Quick Connect sign in: shows the code from the server and polls once a second until another
 * signed in device confirms it (Jellyfin web or BurrowCinema on the phone), for at most 10 minutes.
 */
export function QuickConnectPanel({
  server,
  onSignedIn,
  onCancel,
}: {
  server: string
  onSignedIn: (s: Session) => void
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const signedIn = useRef(onSignedIn)
  useEffect(() => {
    signedIn.current = onSignedIn
  })

  useBackHandler(() => {
    onCancel()
    return true
  })

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!(await quickConnectEnabled(server))) throw new Error('Quick Connect ist auf dem Server ausgeschaltet.')
      const started = await initiateQuickConnect(server)
      if (!active) return
      setCode(started.code)
      for (const deadline = Date.now() + CODE_LIFETIME_MS; Date.now() < deadline; ) {
        await sleep(POLL_MS)
        if (!active) return
        // A failed poll (for example a short network drop) just waits for the next one.
        if (await isQuickConnectAuthorized(server, started.secret).catch(() => false)) {
          const session = await loginWithQuickConnect(server, started.secret)
          if (active) signedIn.current(session)
          return
        }
      }
      throw new Error('Der Code ist abgelaufen. Bitte starte Quick Connect neu.')
    }
    run().catch((err) => active && setError(errorText(err)))
    return () => {
      active = false
    }
  }, [server, attempt])

  const retry = () => {
    setCode('')
    setError('')
    setAttempt((n) => n + 1)
  }

  return (
    <Card>
      <CardTitle>Quick Connect</CardTitle>
      <CardDescription>
        Öffne Jellyfin auf einem angemeldeten Gerät und bestätige dort den Code unter Quick Connect. In BurrowCinema auf dem Handy findest
        du das unter Einstellungen, TV verbinden.
      </CardDescription>
      {error ? (
        <Text className="text-sm text-destructive">{error}</Text>
      ) : code ? (
        <View className="items-center gap-2 py-2">
          <Text selectable className="text-5xl font-bold text-primary" style={{ letterSpacing: 8 }}>
            {code}
          </Text>
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text className="text-sm text-muted-foreground">Warte auf Bestätigung</Text>
          </View>
        </View>
      ) : (
        <View className="py-6">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      <View className="flex-row gap-3">
        {!!error && (
          <Button size="lg" className="flex-1" preferredFocus onPress={retry}>
            Erneut versuchen
          </Button>
        )}
        <Button variant="secondary" size="lg" className="flex-1" preferredFocus={!error} onPress={onCancel}>
          Abbrechen
        </Button>
      </View>
    </Card>
  )
}
