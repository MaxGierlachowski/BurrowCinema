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

**Prüfen vor dem Abschluss**
```bash
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/<eigener-ordner>
```
Pakete nur mit `npx expo install` hinzufügen.

## Starten
```bash
npm install
npx expo run:android   # Development Build auf Gerät oder Emulator
```
