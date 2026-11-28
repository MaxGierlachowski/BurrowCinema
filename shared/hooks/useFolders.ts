import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { loadFolders, saveFolders, type Folder, type FolderItem } from '../folders'
import { getPlatform, uuid } from '../platform'
import { useSession } from './useAuth'

const KEY = ['folders']

export function useFolders() {
  const session = useSession()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: KEY, queryFn: () => loadFolders(session) })

  const mutation = useMutation({
    mutationFn: (folders: Folder[]) => saveFolders(session, folders),
    onMutate: (folders) => queryClient.setQueryData(KEY, folders),
    onError: () => {
      getPlatform().notify.error('Ordner konnten nicht mit Jellyfin synchronisiert werden')
      // Drop the optimistic state and reload what Jellyfin has.
      void queryClient.invalidateQueries({ queryKey: KEY })
    },
    scope: { id: 'folders' },
  })

  const update = (change: (folders: Folder[]) => Folder[]) =>
    mutation.mutate(change(queryClient.getQueryData<Folder[]>(KEY) ?? []))

  const editFolder = (id: string, change: (folder: Folder) => Folder) =>
    update((folders) => folders.map((f) => (f.id === id ? change(f) : f)))

  return {
    folders: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    create: (name: string, items: FolderItem[] = []) =>
      update((folders) => [...folders, { id: uuid(), name, items, createdAt: Date.now() }]),
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
