import { NativeTabs } from 'expo-router/native-tabs'
import { colors } from '@shared/theme'

/** System tab bar (Material 3 on Android, native on iOS) with the same five sections as the web app. */
export default function TabLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.card}
      indicatorColor={colors.accent}
      labelVisibilityMode="labeled"
      tintColor={colors.primary}
      labelStyle={{ default: { color: colors.mutedForeground }, selected: { color: colors.primary } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Bibliothek</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'film', selected: 'film.fill' }} md="movie" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Suche</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="draws">
        <NativeTabs.Trigger.Label>Auslosung</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'dice', selected: 'dice.fill' }} md="casino" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="folders">
        <NativeTabs.Trigger.Label>Ordner</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'folder', selected: 'folder.fill' }} md="folder_special" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Einstellungen</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
