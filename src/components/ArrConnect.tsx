import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ARR_LABEL, getArrSettings, setArrConfig, testArr, type ArrKind } from '@/lib/arr'
import { isMixedContent, normalizeUrl } from '@/lib/storage'

export const ARR_HINT = (kind: ArrKind) => `Den API Key findest du in ${ARR_LABEL[kind]} unter Settings, General, Security.`

type FormProps = { kind: ArrKind; onChange?: (connected: boolean) => void }

/** URL and API key form that tests the connection before saving it. */
export function ArrForm({ kind, onChange }: FormProps) {
  const saved = getArrSettings()[kind]
  const [url, setUrl] = useState(saved?.url ?? '')
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '')
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
      toast.success(`${label} ${status.version} verbunden`)
      onChange?.(true)
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
    onChange?.(false)
  }

  return (
    <form onSubmit={connect} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${kind}-url`}>Adresse</Label>
        <Input id={`${kind}-url`} inputMode="url" autoCapitalize="none" placeholder={`${kind}.example.com`} value={url} onChange={(e) => setUrl(e.target.value)} required className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${kind}-key`}>API Key</Label>
        <Input id={`${kind}-key`} type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required className="h-10" />
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

export function ConnectedIcon() {
  return <CheckCircle2 className="size-4 text-emerald-400" />
}

/** Wraps any trigger so tapping it opens the connection form in a popup. */
export function ArrDialog({ kind, children, onChange }: FormProps & { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ARR_LABEL[kind]} verbinden
            {getArrSettings()[kind] && <ConnectedIcon />}
          </DialogTitle>
          <DialogDescription>{ARR_HINT(kind)}</DialogDescription>
        </DialogHeader>
        <ArrForm
          kind={kind}
          onChange={(connected) => {
            setOpen(false)
            onChange?.(connected)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
