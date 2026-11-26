# Native App mit Expo: Plan

Ziel: BurrowCinema zusätzlich als native App (zuerst Android als APK), die genauso aussieht und funktioniert wie die Web App und möglichst viel Code mit ihr teilt.

## 1. Strategie zum Teilen

Web (Vite, DOM, shadcn/ui) und Native (React Native) können sichtbare Komponenten nicht 1:1 teilen, wohl aber alles darunter. Deshalb drei Ebenen:

| Ebene | Ort | Geteilt? |
|-------|-----|----------|
| Logik: API Clients (Jellyfin, Radarr, Sonarr, Auslosung), Datenmodelle, Ordner, Einstellungen Sync, Formatierung, Mischen der Karten | `shared/` | ja, identischer Code |
| React Hooks: Anmeldung, Ordner | `shared/hooks/` | ja, identischer Code |
| Design Tokens: Farben, Radien | `shared/theme.ts` | ja, Web CSS und Native Tailwind nutzen dieselben Werte |
| Sichtbare Komponenten | `src/components` (Web), `app/src/components` (Native) | gleiche Namen, gleiche Props, gleiche Tailwind Klassen, aber eigene Umsetzung |

Damit ändert man Verhalten und Datenzugriff nur an einer Stelle. Die Oberfläche bleibt parallel, aber leicht synchron zu halten, weil Komponenten und Klassen gleich heißen.

### Plattform Unterschiede werden injiziert
`shared/platform.ts` bekommt beim Start pro Plattform:
* Speicher: Web `localStorage`, Native `expo-sqlite/kv-store` (synchron, wie `localStorage`)
* Gerätename für Jellyfin, Hinweise (Toasts), optional die eingebaute Server Adresse

Ausserdem verzichtet `shared/` auf Dinge, die React Native nicht kann: kein `window`, kein `import.meta`, kein `URLSearchParams`, kein `Intl.RelativeTimeFormat`, kein `crypto.randomUUID` ohne Fallback.

### Auflösen der geteilten Dateien
* Web: Alias `@shared` in Vite und TypeScript.
* Native: Alias `@shared` per `tsconfig` Pfaden. Metro beobachtet zusätzlich den Ordner `shared/` und löst Pakete nur aus `app/node_modules` auf, damit React und TanStack Query nicht doppelt geladen werden.
* `app/` bleibt ein eigenständiges Projekt mit eigenen Abhängigkeiten (kein npm Workspace). So kollidieren die React Versionen von Web und Native nicht.

## 2. Technik der App

| Bereich | Wahl |
|---------|------|
| Basis | Expo SDK 58, React Native 0.88, New Architecture, Hermes, React Compiler |
| Navigation | Expo Router mit nativen Tabs und Stacks |
| Styling | NativeWind 4 (Tailwind Klassen wie im Web), Farben aus `shared/theme.ts` |
| Listen | FlashList für Raster und lange Listen |
| Bilder | `expo-image` mit Speicher und Disk Cache |
| Gesten und Animation | Reanimated 4 und Gesture Handler (Swipe Karten auf dem UI Thread) |
| Haptik | `expo-haptics` bei Swipe, Auswahl und Erfolg |
| Benachrichtigungen | `expo-notifications`: lokale Erinnerungen zu Start und Ende von Auslosungen. `expo-background-task` prüft regelmässig auf neue Einladungen |
| Speicher | `expo-sqlite/kv-store` für Session und Cache |
| Daten | TanStack Query, Cache wird auf dem Gerät gespeichert, damit die App sofort Inhalte zeigt |
| Edge to Edge | Inhalte unter Status und Navigationsleiste, Abstände über Safe Area Insets |
| Netzwerk | HTTP im Heimnetz erlaubt (`usesCleartextTraffic`), anders als im Browser |

## 3. Struktur

```
shared/                  geteilte Logik, Hooks, Theme
src/                     Web App (nutzt @shared)
app/                     Expo App
  src/app/               Routen (Expo Router)
    _layout.tsx          Provider, Theme, Toasts
    login.tsx
    (tabs)/              Bibliothek, Suche, Auslosung, Ordner, Einstellungen
    item/[id].tsx, external/[source]/[id].tsx, folders/[id].tsx
    draws/new.tsx, draws/[id].tsx, draws/stats.tsx
  src/components/        UI Bausteine mit denselben Namen wie im Web
  src/lib/               Plattform Setup, Benachrichtigungen, Hintergrundaufgaben
server/                  Auslosung Backend (unverändert)
```

## 4. Build und Release
* Workflow `android.yml`: `expo prebuild` und Gradle `assembleRelease` auf GitHub Actions, ohne Expo Konto.
* Bei Änderungen an `app/` oder `shared/` wird ein APK als Artefakt gebaut.
* Ein Tag wie `001` erzeugt ein GitHub Release mit dem APK zum Herunterladen.
* Signiert mit dem Standard Schlüssel von Expo. Das reicht zum direkten Installieren, nicht für den Play Store.

## 5. Ablauf
1. `shared/` aus der Web App herauslösen, Web App darauf umstellen, alle Web Tests erneut laufen lassen.
2. Expo Projekt aufsetzen: Abhängigkeiten, NativeWind, Metro, Plattform Setup, Login, Tabs, UI Bausteine, Icons.
3. Parallel mit Sub Agents:
   * Medien: Bibliothek, Suche, Detailseiten, Ordner hinzufügen, Anfragen
   * Ordner und Einstellungen
   * Auslosung mit Swipe, Ergebnis, Statistik, Benachrichtigungen, Hintergrundprüfung
4. Zusammenführen, Typprüfung, JavaScript Bundle für Android bauen.
5. Workflow für APK und Release, Release `001` erstellen.

## 6. Risiken
| Risiko | Umgang |
|--------|--------|
| Kein echtes Gerät zum Testen in dieser Umgebung | Typprüfung und vollständiger Android Bundle Build lokal, APK Build in GitHub Actions |
| Versionskonflikte bei nativen Paketen | Nur Versionen, die zu Expo SDK 58 passen (`expo install`) |
| Push Benachrichtigungen bräuchten Firebase | Stattdessen lokale Benachrichtigungen und Hintergrundprüfung |
| APK nicht im Play Store | Bewusst: Sideload über das GitHub Release |
