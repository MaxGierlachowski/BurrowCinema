import { useState } from 'react'
import { toast } from 'sonner-native'
import { useSession } from '@shared/hooks/useAuth'
import { authorizeQuickConnect } from '@shared/quickConnect'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { haptic } from '@/lib/haptics'

/** Confirms the Quick Connect code a TV shows, which signs the TV in with this account. */
export function TvConnectCard() {
  const session = useSession()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const connect = async () => {
    setLoading(true)
    try {
      await authorizeQuickConnect(session, code)
      haptic.success()
      toast.success('TV verbunden')
      setCode('')
    } catch (err) {
      haptic.error()
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardTitle>TV verbinden</CardTitle>
      <CardDescription>Wähle auf dem Fernseher „Mit Quick Connect anmelden“ und gib den angezeigten Code hier ein.</CardDescription>
      <Input
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
        placeholder="Code"
        accessibilityLabel="TV Code"
        keyboardType="number-pad"
        maxLength={6}
        onSubmitEditing={() => code.length === 6 && connect()}
      />
      <Button variant="secondary" size="lg" className="self-start" loading={loading} disabled={code.length < 6} onPress={connect}>
        Verbinden
      </Button>
    </Card>
  )
}
