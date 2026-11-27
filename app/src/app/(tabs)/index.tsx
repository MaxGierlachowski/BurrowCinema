import { useState } from 'react'
import type { ItemType } from '@shared/jellyfin'
import { HomeRows } from '@/components/home/HomeRows'
import { TvHome } from '@/components/home/TvHome'
import { LibraryGrid } from '@/components/media/LibraryGrid'
import { Screen } from '@/components/Screen'
import { isTV, useFocusMemory } from '@/lib/tv'

/** Phone: home rows above the full library grid. */
function PhoneHome() {
  const [type, setType] = useState<ItemType>('Movie')
  const focus = useFocusMemory('home')
  return (
    <Screen>
      <LibraryGrid title="Bibliothek" type={type} onTypeChange={setType} rows={<HomeRows focus={focus} />} />
    </Screen>
  )
}

export default function Home() {
  return isTV ? <TvHome /> : <PhoneHome />
}
