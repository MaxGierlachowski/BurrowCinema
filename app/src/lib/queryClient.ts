import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import Storage from 'expo-sqlite/kv-store'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60_000, gcTime: 24 * 60 * 60_000, retry: 1 },
  },
})

/** The query cache is kept on the device, so lists show instantly on the next start and refresh in the background. */
export const persister = createAsyncStoragePersister({ storage: Storage, key: 'bc.queryCache', throttleTime: 2000 })

export const persistOptions = {
  persister,
  maxAge: 7 * 24 * 60 * 60_000,
  buster: '0.0.2',
  dehydrateOptions: {
    // Settings must always be synced fresh from Jellyfin at startup.
    shouldDehydrateQuery: (q: { queryKey: readonly unknown[]; state: { status: string } }) =>
      q.state.status === 'success' && q.queryKey[0] !== 'user-settings',
  },
}
