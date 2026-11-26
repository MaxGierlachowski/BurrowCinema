import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { ARR_LABEL, getRequestOptions, requestArr, type ArrItem, type RequestOptions } from '@shared/arr'
import { getSettings, updateSettings } from '@shared/userSettings'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string; hint?: string }

function OptionList({ title, options, value, onChange }: { title: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="px-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
        >
          <span
            className={cn(
              'grid size-5 place-items-center rounded-full border transition-colors',
              value === option.value && 'border-primary bg-primary text-primary-foreground',
            )}
          >
            {value === option.value && <Check className="size-3.5" />}
          </span>
          <span className="flex-1 truncate font-medium">{option.label}</span>
          {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
        </button>
      ))}
    </div>
  )
}

const formatSpace = (bytes?: number) => (bytes ? `${(bytes / 1024 ** 4).toFixed(1)} TB frei` : undefined)

export function RequestButton({ item }: { item: ArrItem }) {
  const kind = item.source
  const label = ARR_LABEL[kind]
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<string>()
  const [folder, setFolder] = useState<string>()

  const options = useQuery({ queryKey: ['arr-options', kind], queryFn: () => getRequestOptions(kind), enabled: open })
  const profiles = options.data?.profiles ?? []
  const folders = options.data?.folders ?? []

  // Preselect what was used last time, otherwise the first entry.
  const last: Partial<RequestOptions> = getSettings().lastRequest?.[kind] ?? {}
  const profileId = profile ?? String((profiles.find((p) => p.id === last.qualityProfileId) ?? profiles[0])?.id ?? '')
  const folderPath = folder ?? (folders.find((f) => f.path === last.rootFolderPath) ?? folders[0])?.path ?? ''

  const request = useMutation({
    mutationFn: () => {
      const chosen = { qualityProfileId: Number(profileId), rootFolderPath: folderPath }
      updateSettings({ lastRequest: { ...getSettings().lastRequest, [kind]: chosen } }).catch(() => undefined)
      return requestArr(kind, item.id, chosen)
    },
    onSuccess: () => {
      toast.success(`${item.title} wurde in ${label} angefragt`)
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ['arr-item', kind, item.id] })
      queryClient.invalidateQueries({ queryKey: ['arr-search', kind] })
    },
    onError: (err) => toast.error(`${label}: ${err.message}`),
  })

  if (item.inArr) {
    return (
      <Button size="lg" variant="secondary" disabled>
        <Check /> Bereits angefragt
      </Button>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="lg">
          <Download /> Anfragen
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader>
            <DrawerTitle>{kind === 'radarr' ? 'Film' : 'Serie'} anfragen</DrawerTitle>
            <DrawerDescription>
              {item.title} wird in {label} hinzugefügt und sofort gesucht.
            </DrawerDescription>
          </DrawerHeader>

          <div className="max-h-[50vh] space-y-5 overflow-y-auto px-4">
            {options.isLoading && <Skeleton className="h-40 rounded-lg" />}
            {options.isError && <p className="text-sm text-destructive">{options.error.message}</p>}
            {profiles.length > 0 && (
              <OptionList
                title="Qualitätsprofil"
                value={profileId}
                onChange={setProfile}
                options={profiles.map((p) => ({ value: String(p.id), label: p.name }))}
              />
            )}
            {folders.length > 1 && (
              <OptionList
                title="Speicherort"
                value={folderPath}
                onChange={setFolder}
                options={folders.map((f) => ({ value: f.path, label: f.path, hint: formatSpace(f.freeSpace) }))}
              />
            )}
          </div>

          <div className="p-4">
            <Button
              size="lg"
              className="w-full"
              disabled={!profileId || !folderPath || request.isPending}
              onClick={() => request.mutate()}
            >
              {request.isPending ? <Loader2 className="animate-spin" /> : <Download />}
              Jetzt anfragen
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
