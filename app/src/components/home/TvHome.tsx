import { router } from 'expo-router'
import { Clapperboard, Tv } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { HomeRows } from '@/components/home/HomeRows'
import { TvHero } from '@/components/home/TvHero'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { libraryHref } from '@/lib/routes'
import { Focusable, useFocusMemory } from '@/lib/tv'

const LIBRARIES = [
  { type: 'Movie', label: 'Alle Filme', icon: Clapperboard },
  { type: 'Series', label: 'Alle Serien', icon: Tv },
] as const

// The hero takes the focus once per app start; afterwards the remembered card wins.
let heroFocused = false

/** TV start screen: hero, the home rows and the way into the full libraries. The sidebar (TvTabs) adds its own spacing. */
export function TvHome() {
  const memory = useFocusMemory('home')
  const [heroFocus, setHeroFocus] = useState(!heroFocused)
  useEffect(() => {
    heroFocused = true
  }, [])
  const focus = {
    preferred: memory.preferred,
    remember: (key: string) => {
      setHeroFocus(false)
      memory.remember(key)
    },
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-8 pb-12">
      <TvHero preferredFocus={heroFocus} />
      <HomeRows focus={focus} />
      <View className="mt-6">
        <Text className="mb-3 text-lg font-semibold">Bibliotheken</Text>
        <View className="flex-row gap-4 py-2">
          {LIBRARIES.map(({ type, label, icon }) => (
            <Focusable
              key={type}
              accessibilityLabel={label}
              preferredFocus={focus.preferred(type)}
              onPress={() => {
                focus.remember(type)
                router.push(libraryHref(type))
              }}
              className="h-24 w-64 flex-row items-center gap-4 rounded-xl bg-card px-6"
            >
              <Icon as={icon} size={28} color="primary" />
              <Text className="text-lg font-semibold">{label}</Text>
            </Focusable>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}
