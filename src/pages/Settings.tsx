import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Page, PageHeader } from '@/components/AppShell'
import { ARR_HINT, ArrForm, ConnectedIcon } from '@/components/ArrConnect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth, useSession } from '@/hooks/useAuth'
import { ARR_LABEL, getArrSettings, type ArrKind } from '@/lib/arr'

function ArrCard({ kind }: { kind: ArrKind }) {
  const [connected, setConnected] = useState(() => Boolean(getArrSettings()[kind]))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {ARR_LABEL[kind]}
          {connected && <ConnectedIcon />}
        </CardTitle>
        <CardDescription>{ARR_HINT(kind)}</CardDescription>
      </CardHeader>
      <CardContent>
        <ArrForm kind={kind} onChange={setConnected} />
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
