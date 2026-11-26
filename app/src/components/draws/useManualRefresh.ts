import { useState } from 'react'

/** Pull to refresh state that ignores background refetches, so the spinner only shows when the user pulled. */
export function useManualRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = async () => {
    setRefreshing(true)
    await refetch().catch(() => undefined)
    setRefreshing(false)
  }
  return { refreshing, onRefresh }
}
