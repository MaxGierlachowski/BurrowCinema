import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router'
import { Logo } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { login } from '@/lib/jellyfin'
import { isMixedContent, load, normalizeUrl, save } from '@/lib/storage'

export default function Login() {
  const { session, signIn } = useAuth()
  const [server, setServer] = useState(() => load('bc.lastServer', ''))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (isMixedContent(normalizeUrl(server))) {
      setError('Diese Seite läuft über HTTPS, daher muss auch Jellyfin per https:// erreichbar sein.')
      return
    }
    setLoading(true)
    try {
      const next = await login(server, username, password)
      save('bc.lastServer', next.server)
      signIn(next)
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Server nicht erreichbar. Stimmt die Adresse und ist Jellyfin per HTTPS erreichbar?'
          : (err as Error).message,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative w-full max-w-sm space-y-6">
        <Logo className="justify-center text-xl" />
        <Card>
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>Mit deinem Jellyfin Account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="server">Server</Label>
                <Input
                  id="server"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="jellyfin.example.com"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Benutzername</Label>
                <Input
                  id="username"
                  autoCapitalize="none"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                Anmelden
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
