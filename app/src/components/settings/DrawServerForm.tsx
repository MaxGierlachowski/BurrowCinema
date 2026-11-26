import { useState, type ComponentType } from 'react'
import { View, type TextInputProps } from 'react-native'
import { toast } from 'sonner-native'
import { getDrawServer, setDrawServer, testDrawServer } from '@shared/draws'
import { normalizeUrl } from '@shared/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { haptic } from '@/lib/haptics'

export const DRAW_SERVER_HINT = 'Adresse des BurrowCinema Servers, der die Auslosungen für alle speichert.'

type Props = { onChange?: (connected: boolean) => void; InputComponent?: ComponentType<TextInputProps> }

export function DrawServerForm({ onChange, InputComponent = Input }: Props) {
  const saved = getDrawServer()
  const [url, setUrl] = useState(saved)
  const [testing, setTesting] = useState(false)

  const connect = async () => {
    const target = normalizeUrl(url)
    setTesting(true)
    try {
      await testDrawServer(target)
      await setDrawServer(target).catch(() => toast.warning('Nur auf diesem Gerät gespeichert, Jellyfin Profil nicht erreichbar'))
      setUrl(target)
      haptic.success()
      toast.success('Auslosung Server verbunden')
      onChange?.(true)
    } catch (err) {
      haptic.error()
      toast.error(`Server: ${err instanceof TypeError ? 'nicht erreichbar' : (err as Error).message}`)
    } finally {
      setTesting(false)
    }
  }

  const disconnect = () => {
    setDrawServer(null).catch(() => toast.warning('Nur auf diesem Gerät entfernt, Jellyfin Profil nicht erreichbar'))
    setUrl('')
    onChange?.(false)
  }

  return (
    <View className="gap-4">
      <View>
        <Label>Adresse</Label>
        <InputComponent value={url} onChangeText={setUrl} placeholder="burrow.example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      </View>
      <View className="flex-row gap-2">
        <Button loading={testing} disabled={!url} onPress={connect}>
          {saved ? 'Erneut testen' : 'Verbinden'}
        </Button>
        {saved && (
          <Button variant="ghost" onPress={disconnect}>
            Trennen
          </Button>
        )}
      </View>
    </View>
  )
}
