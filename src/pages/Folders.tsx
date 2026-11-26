import { FolderHeart, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Page, PageHeader } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { NameDialog } from '@/components/NameDialog'
import { Poster } from '@/components/PosterCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFolders } from '@shared/hooks/useFolders'
import type { Folder } from '@shared/folders'
import { plural } from '@shared/format'

function FolderCard({ folder }: { folder: Folder }) {
  const covers = folder.items.slice(-4).reverse()
  return (
    <Link to={`/folders/${folder.id}`} className="group block">
      <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-muted ring-1 ring-white/5 transition group-hover:ring-primary/60">
        {covers.map((item) => (
          <div key={item.key} className="overflow-hidden">
            <Poster src={item.poster} title={item.title} />
          </div>
        ))}
        {covers.length === 0 && (
          <div className="col-span-2 row-span-2 grid place-items-center text-muted-foreground">
            <FolderHeart className="size-10" />
          </div>
        )}
      </div>
      <p className="mt-2 truncate font-medium">{folder.name}</p>
      <p className="text-xs text-muted-foreground">{plural(folder.items.length, 'Titel', 'Titel')}</p>
    </Link>
  )
}

export default function Folders() {
  const { folders, isLoading, create } = useFolders()

  const createButton = (
    <NameDialog
      title="Neuer Ordner"
      confirmLabel="Anlegen"
      onSubmit={(name) => create(name)}
      trigger={<Button size="lg"><Plus /> Neuer Ordner</Button>}
    />
  )

  return (
    <Page>
      <PageHeader title="Ordner" subtitle="Eigene Sammlungen, auch mit Titeln, die noch fehlen">
        {folders.length > 0 && createButton}
      </PageHeader>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      )}

      {!isLoading && folders.length === 0 && (
        <EmptyState
          icon={FolderHeart}
          title="Noch keine Ordner"
          text="Leg einen Ordner an, zum Beispiel „Filmabend“ oder „Watchlist“, und füge Titel über ihre Detailseite hinzu."
        >
          {createButton}
        </EmptyState>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {folders.map((folder) => <FolderCard key={folder.id} folder={folder} />)}
      </div>
    </Page>
  )
}
