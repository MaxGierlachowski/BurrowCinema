import { router, useIsFocused, usePathname } from 'expo-router'
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui'
import { Film, FolderHeart, House, Search, Settings, Tv } from 'lucide-react-native'
import { useRef } from 'react'
import { View } from 'react-native'
import { toast } from 'sonner-native'
import { Logo } from '@/components/BurrowMark'
import { libraryHref } from '@/lib/routes'
import { useBackHandler } from '@/lib/tv'
import { SidebarItem, sidebarStyle } from './TvSidebar'

const EXIT_WINDOW_MS = 2000

/** Back on TV: from another tab to Start; on Start a second press within 2 s leaves the app. */
function useTvBack() {
  const pathname = usePathname()
  const screenFocused = useIsFocused()
  const lastPress = useRef(0)
  useBackHandler(() => {
    if (pathname !== '/') {
      router.navigate('/')
      return true
    }
    if (Date.now() - lastPress.current < EXIT_WINDOW_MS) return false // system default: leave the app
    lastPress.current = Date.now()
    toast('Zum Beenden erneut Zurück drücken', { duration: EXIT_WINDOW_MS })
    return true
  }, screenFocused)
}

/**
 * TV navigation: headless tabs with a focusable sidebar on the left. Auslosung is not on TV,
 * Filme and Serien open the library screens on the stack.
 */
export function TvTabs() {
  useTvBack()
  return (
    <Tabs style={{ flexDirection: 'row' }}>
      <TabList style={sidebarStyle}>
        <View className="mb-8 px-4">
          <Logo />
        </View>
        <TabTrigger name="index" href="/" asChild>
          <SidebarItem icon={House} label="Start" />
        </TabTrigger>
        <TabTrigger name="search" href="/search" asChild>
          <SidebarItem icon={Search} label="Suche" />
        </TabTrigger>
        <SidebarItem icon={Film} label="Filme" onPress={() => router.push(libraryHref('Movie'))} />
        <SidebarItem icon={Tv} label="Serien" onPress={() => router.push(libraryHref('Series'))} />
        <TabTrigger name="folders" href="/folders" asChild>
          <SidebarItem icon={FolderHeart} label="Ordner" />
        </TabTrigger>
        <TabTrigger name="settings" href="/settings" asChild>
          <SidebarItem icon={Settings} label="Einstellungen" />
        </TabTrigger>
      </TabList>
      <TabSlot style={{ flex: 1 }} />
    </Tabs>
  )
}
