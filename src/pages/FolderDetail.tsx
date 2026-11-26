import { FolderOpen, MoreHorizontal, Pencil, Search, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Page, PageHeader } from '@/components/AppShell'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { NameDialog } from '@/components/NameDialog'
import { PosterCard, PosterGrid, PosterGridSkeleton } from '@/components/PosterCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFolders } from '@/hooks/useFolders'
import type { FolderItem } from '@/lib/folders'
import { plural } from '@/lib/format'

const FILTERS: Record<string, { label: string; test: (i: FolderItem) => boolean }> = {
  all: { label: 'Alle', test: () => true },
  movie: { label: 'Filme', test: (i) => i.type === 'movie' },
  series: { label: 'Serien', test: (i) => i.type === 'series' },
  missing: { label: 'Fehlt', test: (i) => i.source !== 'jellyfin' },
}

export default function FolderDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { folders, isLoading, rename, remove, restore, toggleItem } = useFolders()
  const [filter, setFilter] = useState('all')
  const [renaming, setRenaming] = useState(false)
  const folder = folders.find((f) => f.id === id)

  if (isLoading) return <Page><PosterGridSkeleton /></Page>
  if (!folder) {
    return (
      <Page>
        <EmptyState icon={BurrowMark} title="Dieser Gang führt nirgendwohin" text="Den Ordner gibt es nicht mehr.">
          <Button asChild variant="secondary"><Link to="/folders">Zu den Ordnern</Link></Button>
        </EmptyState>
      </Page>
    )
  }

  const deleteFolder = () => {
    remove(folder.id)
    navigate('/folders')
    toast(`„${folder.name}“ gelöscht`, { action: { label: 'Rückgängig', onClick: () => restore(folder) } })
  }

  const removeItem = (item: FolderItem) => {
    toggleItem(folder.id, item)
    toast(`${item.title} entfernt`, { action: { label: 'Rückgängig', onClick: () => toggleItem(folder.id, item) } })
  }

  const items = [...folder.items].reverse().filter(FILTERS[filter].test)
  const missing = folder.items.filter(FILTERS.missing.test).length

  return (
    <Page>
      <PageHeader
        title={folder.name}
        subtitle={`${plural(folder.items.length, 'Titel', 'Titel')}${missing ? `, ${missing} noch nicht geladen` : ''}`}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon-lg" aria-label="Ordner Aktionen">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}><Pencil /> Umbenennen</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={deleteFolder}><Trash2 /> Löschen</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <NameDialog
        key={folder.name}
        title="Ordner umbenennen"
        confirmLabel="Speichern"
        initial={folder.name}
        open={renaming}
        onOpenChange={setRenaming}
        onSubmit={(name) => rename(folder.id, name)}
      />

      {folder.items.length > 0 && (
        <Tabs value={filter} onValueChange={setFilter} className="mb-5">
          <TabsList>
            {Object.entries(FILTERS).map(([key, { label }]) => (
              <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {folder.items.length === 0 && (
        <EmptyState icon={FolderOpen} title="Dieser Ordner ist leer" text="Öffne einen Film oder eine Serie und tippe auf „Zu Ordner hinzufügen“.">
          <Button asChild variant="secondary"><Link to="/search"><Search /> Titel suchen</Link></Button>
        </EmptyState>
      )}

      <PosterGrid>
        {items.map((item) => (
          <PosterCard
            key={item.key}
            item={item}
            badge={item.source !== 'jellyfin' && <Badge variant="secondary" className="bg-black/70 backdrop-blur">Nicht geladen</Badge>}
            action={
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label={`${item.title} entfernen`}
                onClick={() => removeItem(item)}
                className="rounded-full bg-black/60 backdrop-blur hover:bg-black/80"
              >
                <X />
              </Button>
            }
          />
        ))}
      </PosterGrid>
    </Page>
  )
}
