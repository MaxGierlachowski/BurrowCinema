import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react-native'
import { useState } from 'react'
import { toast } from 'sonner-native'
import { useSession } from '@shared/hooks/useAuth'
import { setPlayed, type BaseItem, type Session, type UserData } from '@shared/jellyfin'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { haptic } from '@/lib/haptics'
import { invalidateAfterPlayback, qk } from '@/lib/queryKeys'

type Field = 'Played' | 'IsFavorite'

/** Optimistic toggle of a UserData flag; afterwards everything that shows it is refreshed. */
export function useUserDataToggle(item: BaseItem, field: Field, send: (s: Session, id: string, value: boolean) => Promise<UserData>) {
  const session = useSession()
  const client = useQueryClient()
  const [optimistic, setOptimistic] = useState<boolean>()
  const value = optimistic ?? !!item.UserData?.[field]

  const mutation = useMutation({
    mutationFn: (next: boolean) => send(session, item.Id, next),
    onMutate: (next) => {
      haptic.select()
      setOptimistic(next)
    },
    onSuccess: (data) => {
      client.setQueryData<BaseItem>(qk.item(item.Id), (old) => old && { ...old, UserData: { ...old.UserData, ...data } })
    },
    onError: (err) => {
      haptic.error()
      toast.error(err.message)
    },
    onSettled: async () => {
      // A series marks all its episodes.
      const series = item.Type === 'Series' ? [qk.seasons(item.Id), ['episodes']] : []
      await Promise.all([invalidateAfterPlayback(client, item), ...series.map((queryKey) => client.invalidateQueries({ queryKey }))])
      setOptimistic(undefined)
    },
  })

  return { value, toggle: () => mutation.mutate(!value) }
}

export function WatchedButton({ item }: { item: BaseItem }) {
  const { value, toggle } = useUserDataToggle(item, 'Played', setPlayed)
  return (
    <Button
      size="lg"
      variant={value ? 'default' : 'secondary'}
      className="w-12 px-0"
      haptics={false}
      accessibilityLabel={value ? 'Als ungesehen markieren' : 'Als gesehen markieren'}
      accessibilityRole="togglebutton"
      accessibilityState={{ checked: value }}
      onPress={toggle}
    >
      <Icon as={Check} color={value ? 'primaryForeground' : 'secondaryForeground'} />
    </Button>
  )
}
