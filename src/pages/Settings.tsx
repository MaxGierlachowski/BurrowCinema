import { CheckCircle2, Loader2, LogOut } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Page, PageHeader } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth, useSession } from '@/hooks/useAuth'
import { ARR_LABEL, getArrSettings, setArrConfig, testArr, type ArrKind } from '@/lib/arr'
import { isMixedContent, normalizeUrl } from '@/lib/storage'

const PLACEHOLDER: Record<ArrKind, string> = { radarr: 'radarr.example.com', sonarr: 'sonarr.example.com' }

function ArrCard({ kind }: { kind: ArrKind }) {
  const saved = getArrSettings()[kind]
  const [url, setUrl] = useState(saved?.url ?? '')
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '')
  const [connected, setConnected] = useState(Boolean(saved))
  const [testing, setTesting] = useState(false)
  const label = ARR_LABEL[kind]

  const connect = async (e: React.FormEvent) => {
    e.preventDefault()
    const config = { url: normalizeUrl(url), apiKey: apiKey.trim() }
    if (isMixedContent(config.url)) return toast.error(`${label} muss per https:// erreichbar sein`)
    setTesting(true)
    try {
      const status = await testArr(config)
      setArrConfig(kind, config)
      setUrl(config.url)
      setConnected(true)
      toast.success(`${label} ${status.version} verbunden`)
    } catch (err) {
      toast.error(`${label}: ${err instanceof TypeError ? 'nicht erreichbar' : (err as Error).message}`)
    } finally {
      setTesting(false)
    }
  }

  const disconnect = () => {
    setArrConfig(kind, null)
    setUrl('')
    setApiKey('')
    setConnected(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {label}
          {connected && <CheckCircle2 className="size-4 text-emerald-400" />}
        </CardTitle>
        <CardDescription>
          Den API Key findest du in {label} unter Settings, General, Security.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={connect} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${kind}-url`}>Adresse</Label>
            <Input id={`${kind}-url`} inputMode="url" autoCapitalize="none" placeholder={PLACEHOLDER[kind]} value={url} onChange={(e) => setUrl(e.target.value)} required className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${kind}-key`}>API Key</Label>
            <Input id={`${kind}-key`} type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required className="h-10" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="lg" disabled={testing}>
              {testing && <Loader2 className="animate-spin" />}
              {connected ? 'Erneut testen' : 'Verbinden'}
            </Button>
            {connected && <Button type="button" size="lg" variant="ghost" onClick={disconnect}>Trennen</Button>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function Settings() {
  const session = useSession()
  const { signOut } = useAuth()

  return (
    <Page className="max-w-2xl">
      <PageHeader title="Einstellungen" />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Jellyfin</CardTitle>
            <CardDescription>
              Angemeldet als <span className="text-foreground">{session.userName}</span> auf {session.server}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" size="lg" onClick={signOut}><LogOut /> Abmelden</Button>
          </CardContent>
        </Card>
        <ArrCard kind="radarr" />
        <ArrCard kind="sonarr" />
        <p className="px-1 text-xs text-muted-foreground">
          API Keys bleiben nur in diesem Browser gespeichert. Ordner werden in deinem Jellyfin Profil gespeichert und
          sind auf allen Geräten verfügbar.
        </p>
      </div>
    </Page>
  )
}
