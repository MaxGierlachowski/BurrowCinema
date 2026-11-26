import { Check, FolderPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { useFolders } from '@shared/hooks/useFolders'
import type { FolderItem } from '@shared/folders'
import { plural } from '@shared/format'
import { cn } from '@/lib/utils'

export function AddToFolder({ item, variant = 'default' }: { item: FolderItem; variant?: 'default' | 'secondary' }) {
  const { folders, create, toggleItem } = useFolders()
  const [name, setName] = useState('')
  const count = folders.filter((f) => f.items.some((i) => i.key === item.key)).length

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    create(name.trim(), [item])
    toast.success(`„${name.trim()}“ angelegt`)
    setName('')
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button size="lg" variant={variant}>
          {count ? <Check /> : <FolderPlus />}
          {count ? `In ${plural(count, 'Ordner', 'Ordnern')}` : 'Zu Ordner hinzufügen'}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader>
            <DrawerTitle>Ordner auswählen</DrawerTitle>
            <DrawerDescription>{item.title}</DrawerDescription>
          </DrawerHeader>

          <div className="max-h-[45vh] space-y-1 overflow-y-auto px-4">
            {folders.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Noch keine Ordner. Leg unten den ersten an.</p>
            )}
            {folders.map((folder) => {
              const active = folder.items.some((i) => i.key === item.key)
              return (
                <button
                  key={folder.id}
                  onClick={() => toggleItem(folder.id, item)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent"
                >
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-md border transition-colors',
                      active && 'border-primary bg-primary text-primary-foreground',
                    )}
                  >
                    {active && <Check className="size-4" />}
                  </span>
                  <span className="flex-1 truncate font-medium">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">{folder.items.length}</span>
                </button>
              )
            })}
          </div>

          <form onSubmit={onCreate} className="flex gap-2 p-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neuer Ordner" className="h-10" />
            <Button type="submit" size="lg" variant="secondary" disabled={!name.trim()}>
              <Plus /> Anlegen
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
