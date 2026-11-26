import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Page, PageHeader } from '@/components/AppShell'
import { Initials } from '@/components/DrawParts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/hooks/useAuth'
import { useFolders } from '@/hooks/useFolders'
import { createDraw, TYPE_LABEL, type DrawItemType } from '@/lib/draws'
import { fromJellyfin, type FolderItem } from '@/lib/folders'
import { plural } from '@/lib/format'
import { getAllItems, getItems, getUsers, userImageUrl } from '@/lib/jellyfin'
import { cn } from '@/lib/utils'

const HOUR = 3_600_000
const DURATIONS = [
  { label: '2 Std.', ms: 2 * HOUR },
  { label: '1 Tag', ms: 24 * HOUR },
  { label: '3 Tage', ms: 72 * HOUR },
  { label: '1 Woche', ms: 168 * HOUR },
]

// <input type="datetime-local"> works with local time strings like 2026-11-26T20:00
const toInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const fromInput = (value: string) => new Date(value).getTime()

const matchesType = (item: FolderItem, type: DrawItemType) =>
  type === 'Movie,Series' || item.type === (type === 'Movie' ? 'movie' : 'series')

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export default function NewDraw() {
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { folders } = useFolders()

  const [title, setTitle] = useState('Filmabend')
  const [source, setSource] = useState('library')
  const [itemType, setItemType] = useState<DrawItemType>('Movie')
  const [start, setStart] = useState(() => toInput(Date.now()))
  const [end, setEnd] = useState(() => toInput(Date.now() + 24 * HOUR))
  const [search, setSearch] = useState('')
  const [invited, setInvited] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const users = useQuery({ queryKey: ['users'], queryFn: () => getUsers(session) })
  const folder = folders.find((f) => f.id === source)
  const libraryCount = useQuery({
    queryKey: ['count', itemType],
    queryFn: () => getItems(session, { type: itemType, limit: 1 }),
    enabled: source === 'library',
  })
  const poolSize = folder ? folder.items.filter((i) => matchesType(i, itemType)).length : libraryCount.data?.TotalRecordCount

  const visibleUsers = (users.data ?? []).filter((u) => u.Name.toLowerCase().includes(search.trim().toLowerCase()))
  const toggle = (id: string, name: string) =>
    setInvited(({ [id]: removed, ...rest }) => (removed ? rest : { ...rest, [id]: name }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const startsAt = fromInput(start)
    const endsAt = fromInput(end)
    if (!(endsAt > startsAt)) return toast.error('Das Ende muss nach dem Start liegen')
    setSaving(true)
    try {
      const items = folder
        ? folder.items.filter((i) => matchesType(i, itemType))
        : (await getAllItems(session, itemType)).map((i) => fromJellyfin(session, i))
      if (!items.length) throw new Error('Für diese Auswahl gibt es keine Titel')
      const draw = await createDraw(session, {
        title: title.trim(),
        itemType,
        sourceLabel: folder ? folder.name : 'Bibliothek',
        startsAt,
        endsAt,
        invitees: Object.entries(invited).map(([id, name]) => ({ id, name })),
        items,
      })
      queryClient.invalidateQueries({ queryKey: ['draws'] })
      toast.success(`„${draw.title}“ angelegt`)
      navigate(`/draws/${draw.id}`, { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Page className="max-w-2xl">
      <PageHeader title="Neue Auslosung" />
      <form onSubmit={submit} className="space-y-6">
        <Field label="Name">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="h-10" />
        </Field>

        <Field label="Quelle">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="library">Ganze Bibliothek</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>Ordner: {f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Was wird ausgelost">
          <Tabs value={itemType} onValueChange={(v) => setItemType(v as DrawItemType)}>
            <TabsList className="w-full">
              {(Object.keys(TYPE_LABEL) as DrawItemType[]).map((t) => (
                <TabsTrigger key={t} value={t}>{t === 'Movie,Series' ? 'Beides' : TYPE_LABEL[t]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {poolSize !== undefined && (
            <p className="text-sm text-muted-foreground">{plural(poolSize, 'Titel', 'Titel')} kommen in die Auslosung</p>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required className="h-10" />
          </Field>
          <Field label="Ende">
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required className="h-10" />
          </Field>
        </div>
        <div className="-mt-3 flex flex-wrap gap-2">
          {DURATIONS.map(({ label, ms }) => (
            <Button key={label} type="button" size="sm" variant="secondary" onClick={() => setEnd(toInput(fromInput(start) + ms))}>
              {label}
            </Button>
          ))}
        </div>

        <Field label="Wer ist dabei">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Jellyfin Benutzer suchen" className="h-10 pl-9" />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border p-1">
            {users.isLoading && <p className="p-3 text-sm text-muted-foreground">Lade Benutzer …</p>}
            {users.isSuccess && visibleUsers.length === 0 && <p className="p-3 text-sm text-muted-foreground">Niemand gefunden.</p>}
            {visibleUsers.map((user) => {
              const active = user.Id in invited
              const image = userImageUrl(session, user)
              return (
                <button
                  key={user.Id}
                  type="button"
                  onClick={() => toggle(user.Id, user.Name)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                >
                  {image ? <img src={image} alt="" className="size-8 rounded-full object-cover" /> : <Initials name={user.Name} />}
                  <span className="flex-1 font-medium">{user.Name}</span>
                  <span className={cn('grid size-6 place-items-center rounded-md border', active && 'border-primary bg-primary text-primary-foreground')}>
                    {active && <Check className="size-4" />}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            {Object.keys(invited).length ? `Eingeladen: ${Object.values(invited).join(', ')}` : 'Du bist automatisch dabei.'}
          </p>
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={saving || !title.trim()}>
          {saving && <Loader2 className="animate-spin" />}
          Auslosung anlegen
        </Button>
      </form>
    </Page>
  )
}
