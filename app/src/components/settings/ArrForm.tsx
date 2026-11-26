import { useState, type ComponentType } from 'react'
import { View, type TextInputProps } from 'react-native'
import { toast } from 'sonner-native'
import { ARR_LABEL, getArrSettings, setArrConfig, testArr, type ArrKind } from '@shared/arr'
import { normalizeUrl } from '@shared/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { haptic } from '@/lib/haptics'

export const ARR_HINT = (kind: ArrKind) => `Den API Key findest du in ${ARR_LABEL[kind]} unter Settings, General, Security.`

type Props = { kind: ArrKind; onChange?: (connected: boolean) => void; InputComponent?: ComponentType<TextInputProps> }

/** Same behaviour as the web ArrForm: test the connection, then store it in the Jellyfin profile. */
export function ArrForm({ kind, onChange, InputComponent = Input }: Props) {
  const saved = getArrSettings()[kind]
  const [url, setUrl] = useState(saved?.url ?? '')
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '')
  const [testing, setTesting] = useState(false)
  const label = ARR_LABEL[kind]

  const connect = async () => {
    const config = { url: normalizeUrl(url), apiKey: apiKey.trim() }
    setTesting(true)
    try {
      const status = await testArr(config)
      await setArrConfig(kind, config).catch(() => toast.warning('Nur auf diesem Gerät gespeichert, Jellyfin Profil nicht erreichbar'))
      setUrl(config.url)
      haptic.success()
      toast.success(`${label} ${status.version} verbunden`)
      onChange?.(true)
    } catch (err) {
      haptic.error()
      toast.error(`${label}: ${err instanceof TypeError ? 'nicht erreichbar' : (err as Error).message}`)
    } finally {
      setTesting(false)
    }
  }

  const disconnect = () => {
    setArrConfig(kind, null).catch(() => toast.warning('Nur auf diesem Gerät entfernt, Jellyfin Profil nicht erreichbar'))
    setUrl('')
    setApiKey('')
    onChange?.(false)
  }

  return (
    <View className="gap-4">
      <View>
        <Label>Adresse</Label>
        <InputComponent value={url} onChangeText={setUrl} placeholder={`${kind}.example.com`} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      </View>
      <View>
        <Label>API Key</Label>
        <InputComponent value={apiKey} onChangeText={setApiKey} secureTextEntry autoCapitalize="none" autoCorrect={false} />
      </View>
      <View className="flex-row gap-2">
        <Button loading={testing} disabled={!url || !apiKey} onPress={connect}>
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
