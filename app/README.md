# BurrowCinema App (Expo)

Native App zur Web App im Hauptordner. Plan und Begründung: [../docs/expo-plan.md](../docs/expo-plan.md).

## Konventionen

**Geteilter Code.** Alles ohne Oberfläche kommt aus `../shared` und wird mit `@shared/...` importiert: API Clients (`@shared/jellyfin`, `@shared/arr`, `@shared/draws`), Ordner (`@shared/folders`, `@shared/hooks/useFolders`), Anmeldung (`@shared/hooks/useAuth`), Einstellungen (`@shared/userSettings`), Formatierung (`@shared/format`), Farben (`@shared/theme`). Logik gehört nach `shared/`, nicht in Screens, damit Web und App gleich bleiben. `shared/` darf keine Browser oder React Native APIs benutzen.

**Gleiche Oberfläche wie im Web.** Jeder Screen hat ein Gegenstück in `../src/pages`, jede Komponente in `../src/components`. Gleiche Texte (Deutsch), gleiche Reihenfolge, gleiche Tailwind Klassen wo möglich. Vor dem Bauen eines Screens die Web Datei lesen.

**Styling.** Tailwind Klassen über `className` (Uniwind, Tailwind 4). Farben nur über Tokens: `bg-background`, `bg-card`, `text-muted-foreground`, `bg-primary` usw. (siehe `src/global.css`). Wo ein Farbwert als Prop gebraucht wird (Icons, Gradients), `colors` aus `@shared/theme`. Kein `StyleSheet.create` mit eigenen Farben.

**Bausteine** in `src/components`:
* `ui/`: `Text`, `Button` (Varianten wie im Web, `icon` Prop, `loading`, Haptik eingebaut), `Badge`, `Input`, `Label`, `Card`, `Skeleton`, `Icon` (Lucide wie im Web), `Sheet` (Bottom Sheet auf Basis von `Modal`, statt Web Drawer), `SheetInput` (Eingabe innerhalb eines Sheets). Zwei Sheets nie gleichzeitig öffnen: erst schließen, dann nach etwa 300 ms das nächste öffnen
* `Screen` und `PageHeader` für Tab Screens, `EmptyState`, `BurrowMark`, `Logo`
* `PosterCard`, `Poster` (expo-image mit Cache), `PosterGrid` (FlashList, virtualisiert), `PosterGridSkeleton`
* `settings/ArrForm`, `settings/DrawServerForm`

**Native Verhalten.**
* Haptik über `haptic` aus `@/lib/haptics` (`tap`, `select`, `success`, `warning`, `error`). `Button` macht `tap` selbst.
* Hinweise über `toast` aus `sonner-native` (gleiche API wie `sonner` im Web).
* Lange Listen immer virtualisiert (FlashList), Pull to Refresh wo sinnvoll.
* Edge to Edge: Tab Screens in `Screen` (setzt den oberen Abstand), Stack Screens setzen Abstände selbst über `useSafeAreaInsets`.
* Navigation mit `expo-router` (`router.push`, `useLocalSearchParams`). Links aus `itemLink()` mit `as Href` casten.

**Player** (nur nativ, kein Gegenstück im Web): `src/app/player/[id].tsx` mit `components/player/` und `lib/player/`. Die Wiedergabe läuft über react-native-video (Media3) und nur über `VideoSurface`. Was das Gerät abspielen kann, ermittelt `lib/deviceCaps.ts`; daraus baut `@shared/deviceProfile` das Profil für PlaybackInfo, `@shared/playback` wählt Direct Play, Remux oder Transcoding. Der Jellyfin Token geht nur an den eigenen Server, nie an fremde Quellen oder Untertitel.

**Android TV.** Eine APK für Handy und TV (react-native-tvos, `@react-native-tvos/config-tv`).
* Alles, was man antippen kann, ist auf dem TV ein `Focusable` aus `@/lib/tv` (gleiche Props wie `Pressable`, zeigt den Fokusrahmen). Ein normales `Pressable` ist mit der Fernbedienung nicht erreichbar.
* Vollflächige Hintergründe (Sheet Backdrop, Overlays) bekommen `focusable={false}`, sonst fangen sie den Fokus.
* Auf dem TV `FlatList` statt FlashList, Navigation über `TvSidebar`, Abstände für Overscan beachten.
* Anmeldung am TV per Quick Connect.

**Smoke Test.** `.github/workflows/android-smoke.yml` baut eine x86_64 APK und steuert sie auf einem Handy und einem TV Emulator gegen einen Mock Jellyfin (`.github/scripts/`).

**Prüfen vor dem Abschluss**
```bash
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/<eigener-ordner>
```
Pakete nur mit `npx expo install` hinzufügen.

**Patches.** `patches/react-native-video+6.19.3.patch` (über `patch-package` beim Installieren): Ohne ihn lädt react-native-video externe Untertitel nicht. Bei einem Update von react-native-video prüfen, ob er noch nötig ist.

## Starten
```bash
npm install
npx expo run:android   # Development Build auf Gerät oder Emulator
```
