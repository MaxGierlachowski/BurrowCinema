import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { fromJellyfin } from '@shared/folders'
import { plural } from '@shared/format'
import { useSession } from '@shared/hooks/useAuth'
import { getItem, getPersonItems, posterUrl } from '@shared/jellyfin'
import { BurrowMark } from '@/components/BurrowMark'
import { EmptyState } from '@/components/EmptyState'
import { DetailLayout, DetailMessage, DetailSkeleton } from '@/components/media/DetailLayout'
import { WrapGrid } from '@/components/media/WrapGrid'
import { PosterCard, PosterGridSkeleton } from '@/components/PosterCard'
import { Text } from '@/components/ui/text'
import { qk } from '@/lib/queryKeys'

const born = (date?: string) => (date ? `Geboren ${new Date(date).toLocaleDateString('de-DE')}` : undefined)

/** A person with biography and their movies and series in the library. */
export default function PersonScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const session = useSession()
  const person = useQuery({ queryKey: qk.item(id), queryFn: () => getItem(session, id) })
  const items = useQuery({ queryKey: ['person-items', id], queryFn: () => getPersonItems(session, id) })

  if (person.isLoading) return <DetailSkeleton />
  if (!person.data) {
    return (
      <DetailMessage>
        <EmptyState icon={BurrowMark} title="Dieser Gang führt nirgendwohin" text={person.error?.message ?? 'Person nicht gefunden'} />
      </DetailMessage>
    )
  }

  const list = items.data ?? []
  return (
    <DetailLayout
      title={person.data.Name}
      poster={posterUrl(session, person.data, 500)}
      meta={[born(person.data.PremiereDate), list.length ? plural(list.length, 'Titel', 'Titel') : undefined]}
      overview={person.data.Overview}
    >
      <View className="mt-10">
        <Text className="mb-3 text-lg font-semibold">In deiner Bibliothek</Text>
        {items.isLoading && (
          <View className="-mx-4">
            <PosterGridSkeleton count={6} />
          </View>
        )}
        {items.isSuccess && list.length === 0 && <Text className="text-sm text-muted-foreground">Keine Titel mit dieser Person.</Text>}
        {/* The first title takes the TV focus; a person page has no play button. */}
        <WrapGrid
          data={list}
          keyExtractor={(item) => item.Id}
          renderItem={(item) => <PosterCard item={fromJellyfin(session, item)} preferredFocus={item.Id === list[0].Id} />}
        />
      </View>
    </DetailLayout>
  )
}
