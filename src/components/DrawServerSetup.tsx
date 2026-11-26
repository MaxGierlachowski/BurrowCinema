import { Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDrawServer, setDrawServer, testDrawServer } from '@/lib/draws'
import { isMixedContent, normalizeUrl } from '@/lib/storage'

export const DRAW_SERVER_HINT = 'Adresse des BurrowCinema Servers, der die Auslosungen für alle speichert.'

export function DrawServerForm({ onChange }: { onChange?: (connected: boolean) => void }) {
  const saved = getDrawServer()
  const [url, setUrl] = useState(saved)
  const [testing, setTesting] = useState(false)

  const connect = async (e: React.FormEvent) => {
    e.preventDefault()
    const target = normalizeUrl(url)
    if (isMixedContent(target)) return toast.error('Der Server muss per https:// erreichbar sein')
    setTesting(true)
    try {
      await testDrawServer(target)
      await setDrawServer(target).catch(() => toast.warning('Nur auf diesem Gerät gespeichert, Jellyfin Profil nicht erreichbar'))
      setUrl(target)
      toast.success('Auslosung Server verbunden')
      onChange?.(true)
    } catch (err) {
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
    <form onSubmit={connect} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="draw-server">Adresse</Label>
        <Input id="draw-server" inputMode="url" autoCapitalize="none" placeholder="burrow.example.com" value={url} onChange={(e) => setUrl(e.target.value)} required className="h-10" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={testing}>
          {testing && <Loader2 className="animate-spin" />}
          {saved ? 'Erneut testen' : 'Verbinden'}
        </Button>
        {saved && <Button type="button" size="lg" variant="ghost" onClick={disconnect}>Trennen</Button>}
      </div>
    </form>
  )
}

export function DrawServerDialog({ children, onChange }: { children: ReactNode; onChange?: (connected: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Auslosung Server verbinden</DialogTitle>
          <DialogDescription>{DRAW_SERVER_HINT}</DialogDescription>
        </DialogHeader>
        <DrawServerForm
          onChange={(connected) => {
            setOpen(false)
            onChange?.(connected)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
