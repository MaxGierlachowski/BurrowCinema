import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { loadFolders, saveFolders, type Folder, type FolderItem } from '@/lib/folders'
import { useSession } from './useAuth'

const KEY = ['folders']

export function useFolders() {
  const session = useSession()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: KEY, queryFn: () => loadFolders(session) })

  const mutation = useMutation({
    mutationFn: (folders: Folder[]) => saveFolders(session, folders),
    onMutate: (folders) => queryClient.setQueryData(KEY, folders),
    onError: () => toast.error('Ordner konnten nicht mit Jellyfin synchronisiert werden'),
    scope: { id: 'folders' },
  })

  const update = (change: (folders: Folder[]) => Folder[]) =>
    mutation.mutate(change(queryClient.getQueryData<Folder[]>(KEY) ?? []))

  const editFolder = (id: string, change: (folder: Folder) => Folder) =>
    update((folders) => folders.map((f) => (f.id === id ? change(f) : f)))

  return {
    folders: query.data ?? [],
    isLoading: query.isLoading,
    create: (name: string, items: FolderItem[] = []) =>
      update((folders) => [...folders, { id: crypto.randomUUID(), name, items, createdAt: Date.now() }]),
    rename: (id: string, name: string) => editFolder(id, (f) => ({ ...f, name })),
    remove: (id: string) => update((folders) => folders.filter((f) => f.id !== id)),
    restore: (folder: Folder) => update((folders) => [...folders, folder]),
    toggleItem: (id: string, item: FolderItem) =>
      editFolder(id, (f) => ({
        ...f,
        items: f.items.some((i) => i.key === item.key)
          ? f.items.filter((i) => i.key !== item.key)
          : [...f.items, item],
      })),
  }
}
